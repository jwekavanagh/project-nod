#!/usr/bin/env node
/** @typedef {{ name:string, regex:string, description?: string }} ManifestPattern */
/** @typedef {{ globRoots:string[], ignoredPathSubstrings:string[], patterns:ManifestPattern[], symbolHistoricalAllowFiles:string[] }} Manifest */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import picomatch from "picomatch";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "schemas", "ci", "v4-copy-invariants.manifest.json");

/** @type {Manifest} */
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const globMatchers = manifest.globRoots.map((g) =>
  picomatch(g.replace(/\\/g, "/"), { dot: true, bash: false }),
);

function trackedInScope(relPosix) {
  if (relPosix.includes("node_modules")) return false;
  return globMatchers.some((m) => m(relPosix.replace(/\\/g, "/")));
}

const violations = [];

for (const rel of tracked) {
  const posix = rel.replace(/\\/g, "/");
  if (!trackedInScope(posix)) continue;
  /** @type {string} */
  let text;
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    continue;
  }
  if (posix.startsWith("docs/") && posix.endsWith(".md")) {
    if (!manifest.symbolHistoricalAllowFiles.some((allow) => posix === allow || posix.endsWith(`/${allow}`))) {
      const docSymbolRe =
        /\b(await\s+)?(?:verifyWorkflow|verifyAgentskeptic)\s*\(|\bcreateDecisionGate\s*\(|\brunQuickVerify\b/;
      if (docSymbolRe.test(text)) {
        violations.push({
          kind: "doc_live_symbol_callsite",
          file: rel,
          detail: 'Disallowed programmatic API call sites in prose (allowlist migrate-2/CHANGELOG)',
        });
      }
    }
  }

  for (const p of manifest.patterns ?? []) {
    const re = new RegExp(p.regex, "m");
    if (re.test(text)) violations.push({ kind: p.name, file: rel, detail: p.description ?? p.regex });
  }
}

if (violations.length > 0) {
  console.error("[assert-v4-copy-invariants] violations:");
  for (const v of violations) console.error(`  ${v.kind}: ${v.file} — ${v.detail}`);
  process.exit(1);
}
console.error("assert-v4-copy-invariants: ok");
