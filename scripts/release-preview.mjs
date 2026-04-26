#!/usr/bin/env node
/**
 * PR release eligibility: same @semantic-release/commit-analyzer rules as ship,
 * synthetic squash message = PR title + "\n\n" + PR body.
 * Reads webhook payload from --event <path> (GITHUB_EVENT_PATH in CI).
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { analyzeCommits } from "@semantic-release/commit-analyzer";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--event" && argv[i + 1]) {
      out.eventPath = argv[++i];
    } else if (argv[i] === "--repository-root" && argv[i + 1]) {
      out.repositoryRoot = path.resolve(argv[++i]);
    }
  }
  return out;
}

function pathMatchesPrefix(file, prefix) {
  const f = file.replace(/\\/g, "/");
  if (prefix.endsWith("/")) {
    return f === prefix.slice(0, -1) || f.startsWith(prefix);
  }
  return f === prefix;
}

function loadPrefixes(root) {
  const cfgPath = path.join(root, "release", "preview-enforcement.paths.json");
  const raw = JSON.parse(readFileSync(cfgPath, "utf8"));
  if (raw.version !== 1 || !Array.isArray(raw.prefixes)) {
    throw new Error("release-preview: invalid preview-enforcement.paths.json");
  }
  return raw.prefixes;
}

function enforcedFiles(changedFiles, prefixes) {
  const out = [];
  for (const file of changedFiles) {
    const norm = file.trim();
    if (!norm) continue;
    for (const p of prefixes) {
      if (pathMatchesPrefix(norm, p)) {
        out.push(norm);
        break;
      }
    }
  }
  return out;
}

function appendSummary(line) {
  const p = process.env.GITHUB_STEP_SUMMARY;
  if (p && existsSync(path.dirname(p))) {
    appendFileSync(p, `${line}\n`, "utf8");
  }
}

async function main() {
  const { eventPath, repositoryRoot } = parseArgs(process.argv);
  if (!eventPath) {
    console.error("release-preview: missing --event <path>");
    process.exit(2);
  }

  const root = repositoryRoot ?? defaultRoot;

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const pr = event.pull_request;
  if (!pr) {
    console.error("release-preview: event has no pull_request");
    process.exit(2);
  }

  const baseSha = pr.base.sha;
  const headSha = pr.head.sha;
  const title = pr.title ?? "";
  const body = pr.body ?? "";
  const synthetic = `${title}\n\n${body}`;

  const diff = spawnSync(
    "git",
    ["diff", "--no-renames", "--name-only", `${baseSha}..${headSha}`],
    { cwd: root, encoding: "utf8" },
  );
  if (diff.status !== 0) {
    console.error(diff.stderr || diff.stdout || "git diff failed");
    process.exit(2);
  }

  const changedFiles = diff.stdout.split("\n").filter(Boolean);
  const prefixes = loadPrefixes(root);
  const touched = enforcedFiles(changedFiles, prefixes);

  if (touched.length === 0) {
    appendSummary("RELEASE_PREVIEW_SCOPE=OUTSIDE_ENFORCEMENT_LIST");
    const payload = {
      verdict: "OUTSIDE_ENFORCEMENT_LIST",
      syntheticPreview: false,
    };
    console.log(JSON.stringify(payload));
    appendSummary(`RELEASE_PREVIEW_VERDICT=${payload.verdict}`);
    appendSummary(`RELEASE_PREVIEW_JSON=${JSON.stringify(payload)}`);
    process.exit(0);
  }

  const pluginConfig = require(path.join(root, "release", "commit-analyzer-rules.cjs"));
  const logger = {
    log(...args) {
      console.error(...args);
    },
    error(...args) {
      console.error(...args);
    },
  };

  const releaseType = await analyzeCommits(pluginConfig, {
    commits: [{ hash: "preview", message: synthetic }],
    logger,
    cwd: root,
  });

  const releasable = Boolean(releaseType);
  const verdict = releasable ? "RELEASABLE" : "NOT_RELEASABLE";
  const payload = {
    verdict,
    syntheticPreview: true,
    releaseType: releaseType ?? null,
    enforcedPathsSample: touched.slice(0, 8),
  };
  console.log(JSON.stringify(payload));
  appendSummary(`RELEASE_PREVIEW_VERDICT=${verdict}`);
  appendSummary(`RELEASE_PREVIEW_JSON=${JSON.stringify(payload)}`);

  process.exit(releasable ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
