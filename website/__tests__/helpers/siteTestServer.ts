import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { afterAll } from "vitest";
import { getRepoRoot, loadAnchors } from "./distributionGraphHelpers";

const require = createRequire(import.meta.url);
const { normalize } = require("../../../scripts/public-product-anchors.cjs") as {
  normalize: (s: string) => string;
};

function isAbsoluteHttpOrHttps(s: string): boolean {
  try {
    const { protocol } = new URL(s);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

let child: ChildProcess | undefined;
/** Last lines of `next start` stderr when stdio is piped — for failed readiness diagnostics. */
let lastStartStderr = "";
let startPromise: Promise<void> | null = null;

/**
 * `next build` is memory-heavy; cap V8 heap so the process can grow without asking the OS for
 * more RAM than typical GitHub-hosted runners have (~7GiB total). An 8192MiB cap can still
 * fail there (OOM-kill → exit 1, empty Vitest `spawnSync` diagnostics with stdio:inherit).
 * Override with `SITE_TEST_NODE_HEAP_MB` (digits only, mebibytes) if needed.
 */
function withNodeBuildHeap(e: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const o = { ...e };
  const cur = o.NODE_OPTIONS;
  if (cur != null && String(cur).includes("max-old-space-size")) return o;
  const raw = o.SITE_TEST_NODE_HEAP_MB?.trim();
  let mb = 8192;
  if (raw && /^\d+$/.test(raw)) mb = Number(raw);
  else if (o.CI === "true" || o.GITHUB_ACTIONS === "true") mb = 4096;
  const flag = `--max-old-space-size=${String(mb)}`;
  o.NODE_OPTIONS = cur ? `${String(cur)} ${flag}` : flag;
  return o;
}

/** Run `npm run build` with piped stdio so failures attach a stderr/stdout tail to the thrown error. */
function execNpmRunBuild(cwd: string, env: NodeJS.ProcessEnv, label: string): void {
  const r = spawnSync("npm run build", {
    cwd,
    env,
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 24 * 1024 * 1024,
  });
  if (r.status === 0) return;
  const out = [r.stderr, r.stdout].filter(Boolean).join("\n---\n");
  const tail = out.trim().slice(-16_000);
  throw new Error(
    `siteTestServer: ${label} failed (exit ${String(r.status)}${r.signal ? ` signal=${String(r.signal)}` : ""})\n${tail || "(no output captured)"}`,
  );
}

/** CI runners often need well over 18s for `next start` to listen after a fresh `next build`. */
const READY_POLL_MS = 500;
const READY_ATTEMPTS = 150;

async function waitUntilReady(): Promise<void> {
  for (let i = 0; i < READY_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      const hint = lastStartStderr.trim() ? `\n${lastStartStderr.trim()}` : "";
      throw new Error(
        `siteTestServer: next start exited before ready (code=${child.exitCode} signal=${String(
          child.signalCode,
        )})${hint}`,
      );
    }
    try {
      const res = await fetch("http://127.0.0.1:34100/");
      if (res.ok) return;
    } catch {
      /* retry */
    }
  }
  const hint = lastStartStderr.trim() ? `\n${lastStartStderr.trim()}` : "";
  throw new Error(
    `siteTestServer: next start did not become ready on 127.0.0.1:34100 within ${(READY_ATTEMPTS * READY_POLL_MS) / 1000}s${hint}`,
  );
}

async function startInternal(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("siteTestServer: DATABASE_URL is required (run website Vitest with commercial env)");
  }
  if (!process.env.TELEMETRY_DATABASE_URL?.trim()) {
    throw new Error(
      "siteTestServer: TELEMETRY_DATABASE_URL is required (production-like server + instrumentation)",
    );
  }
  const repoRoot = getRepoRoot();
  execFileSync(process.execPath, [join(repoRoot, "scripts", "core-database-boundary-preflight.mjs")], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  // Website `prebuild` runs the full `sync-website-ssot` pipeline (not only
  // `sync:public-product-anchors`), which can rewrite `config/marketing.json` again.
  // `next.config` calls `assertNextPublicOriginParity()` during `next build` — the env
  // we pass must match the on-disk `productionCanonicalOrigin` *after* that same SSOT
  // materialization, or `next build` exits 1 in CI.
  const ssot = spawnSync("npm run sync-website-ssot", {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });
  if (ssot.status !== 0) {
    throw new Error(`siteTestServer: sync-website-ssot failed (exit ${String(ssot.status)})`);
  }
  const anchors = loadAnchors();
  process.env.NEXT_PUBLIC_APP_URL = normalize(anchors.productionCanonicalOrigin);
  process.env.VERCEL_ENV = "production";

  const websiteDir = join(repoRoot, "website");
  const buildIdPath = join(websiteDir, ".next", "BUILD_ID");
  const reuseDist =
    process.env.WEBSITE_TEST_REUSE_DIST === "1" &&
    existsSync(buildIdPath) &&
    process.env.FORCE_WEBSITE_TEST_BUILD !== "1";
  if (!reuseDist) {
    // The workspace package `agentskeptic` exports from `../dist` (tsc out). A website-only
    // `next build` fails in CI (npm ci) when `dist/` is absent, so build the monorepo first.
    // Use `npm run build` in `website/` (not `npm -w` from the root) so the layout matches
    // published lockfiles; add heap for `next build` on Linux CI.
    const buildPe = withNodeBuildHeap(process.env);
    execNpmRunBuild(repoRoot, buildPe, "npm run build (repo root)");
    // `next build` sets NODE_ENV=production while loading `next.config.ts`, which calls
    // `assertNextPublicOriginParity()`. Any drift vs `config/marketing.json` (or Vitest env)
    // then fails the build with exit 1 and no useful Vitest capture under stdio:inherit.
    // Vercel preview skips that assert (see `public-origin-parity.test.ts`); use the same
    // for this subprocess only. `next start` below still uses `process.env` with VERCEL_ENV=production.
    const buildPeWebsite = {
      ...buildPe,
      VERCEL_ENV: "preview",
      NEXT_TELEMETRY_DISABLED: buildPe.NEXT_TELEMETRY_DISABLED ?? "1",
    };
    execNpmRunBuild(websiteDir, buildPeWebsite, "npm run build (website)");
  }
  const requireWebsite = createRequire(join(websiteDir, "package.json"));
  const nextBin = join(dirname(requireWebsite.resolve("next/package.json")), "dist", "bin", "next");
  if (!existsSync(nextBin)) {
    throw new Error(`siteTestServer: Next.js CLI missing at ${nextBin}`);
  }

  child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", "34100"], {
    cwd: websiteDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  const appendErr = (chunk: Buffer) => {
    lastStartStderr = (lastStartStderr + chunk.toString("utf8")).slice(-12_000);
  };
  child.stderr?.on("data", appendErr);
  child.stdout?.on("data", appendErr);

  await waitUntilReady();
}

/** Idempotent: first Vitest file awaits full start; later files reuse the same server. */
export async function ensureMarketingSiteRunning(): Promise<void> {
  if (!startPromise) {
    startPromise = startInternal();
  }
  await startPromise;
  if (child && (child.exitCode !== null || child.signalCode !== null)) {
    startPromise = startInternal();
    await startPromise;
  }
}

/**
 * Call once at module top level in each test file that uses `getSiteHtml` / `ensureMarketingSiteRunning`.
 * Registers an `afterAll` for that file so the marketing server is torn down before the next file runs
 * (needed when Vitest shares one process across files).
 */
export function registerMarketingSiteTeardown(): void {
  afterAll(async () => {
    if (!child) return;
    const proc = child;
    child = undefined;
    startPromise = null;
    lastStartStderr = "";
    async function waitClose(ms: number): Promise<void> {
      if (proc.exitCode !== null || proc.signalCode !== null) return;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          proc.off("close", onClose);
          reject(new Error("siteTestServer: wait for process close timed out"));
        }, ms);
        const onClose = () => {
          clearTimeout(t);
          resolve();
        };
        proc.once("close", onClose);
      });
    }
    proc.kill("SIGTERM");
    try {
      await waitClose(20_000);
    } catch {
      /* escalate */
    }
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill("SIGKILL");
      await waitClose(10_000);
    }
  });
}

export async function getSiteHtml(path: string): Promise<string> {
  await ensureMarketingSiteRunning();
  const url = isAbsoluteHttpOrHttps(path)
    ? path
    : `http://127.0.0.1:34100${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);
  return res.text();
}
