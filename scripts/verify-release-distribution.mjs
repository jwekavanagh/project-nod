#!/usr/bin/env node
/**
 * After PyPI publish: confirm npm, PyPI JSON, and GitHub Release tag match EXPECTED_VERSION.
 * Checks in order: `npm view` → `https://pypi.org/pypi/.../json` → `gh release view` (see defaultCheckNpm / defaultCheckGh).
 * env EXPECTED_VERSION required (SemVer string without leading v, e.g. 1.0.0).
 * env GH_TOKEN: for gh (set GITHUB_TOKEN in Actions).
 * GitHub: `gh` only.
 */
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import path from "node:path";
import https from "node:https";

const execFileAsync = promisify(execFile);

export const RETRY_MAX_ROUNDS = 6;
export const RETRY_DELAY_MS = 10000;

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} expected
 */
async function defaultCheckNpm(expected) {
  try {
    const { stdout, stderr } = await execFileAsync(
      "npm",
      ["view", `agentskeptic@${expected}`, "version", "--no-progress"],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    );
    const v = String(stdout).trim();
    if (v !== expected) {
      return { ok: false, last: `npm: stdout="${v}" stderr=${JSON.stringify((stderr || "").trim())}` };
    }
    return { ok: true, last: `npm=${v}` };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, last: `npm: error ${m}` };
  }
}

/**
 * @param {string} expected
 */
function defaultGetPypiJson(expected) {
  return new Promise((resolve, reject) => {
    const u = new URL(
      `https://pypi.org/pypi/agentskeptic/${encodeURIComponent(expected)}/json`,
    );
    const req = https.get(u, { headers: { "user-agent": "agentskeptic-verify-release/1" } }, (res) => {
      let b = "";
      res.on("data", (c) => {
        b += c;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(/** @type {unknown} */ (JSON.parse(b)));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`PyPI: HTTP ${res.statusCode} ${(b || "").slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
  });
}

/**
 * @param {string} expected
 * @param {() => Promise<unknown>} getPypiJsonImpl
 */
async function defaultCheckPypi(expected, getPypiJsonImpl) {
  const getJson = getPypiJsonImpl;
  try {
    const data = /** @type {{ info?: { version?: string } }} */ (await getJson());
    const v = data?.info?.version === undefined || data?.info?.version === null
      ? ""
      : String(data.info.version).trim();
    if (v !== expected) {
      return { ok: false, last: `pypi: info.version="${v || "(empty)"}"` };
    }
    return { ok: true, last: `pypi=${v}` };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, last: `pypi: error ${m}` };
  }
}

/**
 * @param {string} expected
 */
async function defaultCheckGh(expected) {
  const tag = `v${expected}`;
  try {
    const { stdout, stderr } = await execFileAsync(
      "gh",
      ["release", "view", tag, "--json", "tagName", "--jq", ".tagName"],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024, env: { ...process.env } },
    );
    const out = String(stdout).trim();
    if (out !== tag) {
      return { ok: false, last: `gh: out="${out}" want="${tag}" err=${JSON.stringify((stderr || "").trim())}` };
    }
    return { ok: true, last: `tag=${out}` };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, last: `gh: error ${m}` };
  }
}

/**
 * @param {{
 *   expected: string;
 *   checkNpm?: (e: string) => Promise<{ ok: boolean; last: string }>;
 *   checkPypi?: (e: string) => Promise<{ ok: boolean; last: string }>;
 *   checkGh?: (e: string) => Promise<{ ok: boolean; last: string }>;
 *   getPypiJson?: (e: string) => Promise<unknown>;
 *   maxRounds?: number;
 *   roundDelayMs?: number;
 * }} o
 */
export async function runReleaseVerify(o) {
  const { expected, maxRounds = RETRY_MAX_ROUNDS, roundDelayMs = RETRY_DELAY_MS } = o;
  const checkNpmF = o.checkNpm ?? defaultCheckNpm;
  const getPypiJsonImpl = o.getPypiJson
    ? () => o.getPypiJson(expected)
    : () => defaultGetPypiJson(expected);
  const checkPypiF = o.checkPypi ?? ((e) => defaultCheckPypi(e, getPypiJsonImpl));
  const checkGhF = o.checkGh ?? defaultCheckGh;

  const last = { npm: "", pypi: "", tag: "" };

  for (let round = 0; round < maxRounds; round++) {
    const a = await checkNpmF(expected);
    last.npm = a.last;
    if (!a.ok) {
      if (round < maxRounds - 1) await sleepMs(roundDelayMs);
      continue;
    }
    const p = await checkPypiF(expected);
    last.pypi = p.last;
    if (!p.ok) {
      if (round < maxRounds - 1) await sleepMs(roundDelayMs);
      continue;
    }
    const g = await checkGhF(expected);
    last.tag = g.last;
    if (g.ok) {
      return {
        success: true,
        line: `verify-release-distribution: ok ${a.last} ${p.last} ${g.last}`,
      };
    }
    if (round < maxRounds - 1) await sleepMs(roundDelayMs);
  }

  return { success: false, last };
}

function mainEnvExpected() {
  const v = String(process.env.EXPECTED_VERSION ?? "").trim();
  if (!v) {
    console.error("verify-release-distribution: set EXPECTED_VERSION to the release semver (no v prefix), e.g. 1.0.0");
    process.exit(1);
  }
  if (v.startsWith("v")) {
    console.error("verify-release-distribution: EXPECTED_VERSION must not include a leading v");
    process.exit(1);
  }
  return v;
}

export async function main() {
  const expected = mainEnvExpected();
  const { success, line, last } = await runReleaseVerify({ expected });
  if (success) {
    console.log(/** @type {string} */ (line));
    return 0;
  }
  if (last) {
    console.error("verify-release-distribution: all rounds failed. Last seen:");
    console.error("  " + (last.npm || ""));
    console.error("  " + (last.pypi || ""));
    console.error("  " + (last.tag || ""));
  }
  return 1;
}

const entryMaybe = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryMaybe && import.meta.url === entryMaybe) {
  const c = await main();
  process.exit(/** @type {number} */ (c) ?? 0);
}
