#!/usr/bin/env node
/**
 * Merge gate: all version-bearing committed paths match root package.json `version`.
 * Usage: node scripts/assert-version-integrity.mjs [root]
 *   root: repository root; default process.cwd()
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const SEMVER_LINE =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-([0-9A-Za-z-]+)(\.[0-9A-Za-z-]+)*)?(\+([0-9A-Za-z-]+)(\.[0-9A-Za-z-]+)*)?$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, "..");

const argv2 = process.argv[2];
const root = typeof argv2 === "string" && argv2.length > 0 ? path.resolve(argv2) : process.cwd() || defaultRoot;

function readCanonicalVersion() {
  const p = path.join(root, "package.json");
  const j = JSON.parse(readFileSync(p, "utf8"));
  const v = String(j.version ?? "").trim();
  if (!v) {
    throw new Error("assert-version-integrity: root package.json missing version");
  }
  if (!SEMVER_LINE.test(v)) {
    throw new Error(`assert-version-integrity: root package.json version is not a valid SemVer 2.0.0 string: ${v}`);
  }
  return v;
}

/**
 * @param {string} expected
 */
function run(expected) {
  const errors = [];

  const relPaths = {
    "package.json": (buf) => {
      const v = String(JSON.parse(buf).version ?? "").trim();
      if (v !== expected) {
        errors.push({ path: "package.json", expected, actual: v || "(empty)" });
      }
    },
    "python/pyproject.toml": (buf) => {
      const m = /^version\s*=\s*"([^"]*)"/m.exec(String(buf));
      if (!m) {
        errors.push({ path: "python/pyproject.toml", expected, actual: "(unparseable [project] version line)" });
        return;
      }
      if (m[1] !== expected) {
        errors.push({ path: "python/pyproject.toml", expected, actual: m[1] });
      }
    },
    "website/package.json": (buf) => {
      const v = String(JSON.parse(buf).version ?? "").trim();
      if (v !== expected) {
        errors.push({ path: "website/package.json", expected, actual: v || "(empty)" });
      }
    },
    "src/publicDistribution.generated.ts": (buf) => {
      const m = /AGENTSKEPTIC_CLI_SEMVER = "([^"]*)"/.exec(String(buf));
      if (!m) {
        errors.push({ path: "src/publicDistribution.generated.ts", expected, actual: "(AGENTSKEPTIC_CLI_SEMVER not found)" });
        return;
      }
      if (m[1] !== expected) {
        errors.push({ path: "src/publicDistribution.generated.ts", expected, actual: m[1] });
      }
    },
    "schemas/openapi-commercial-v1.yaml": (buf) => {
      let doc;
      try {
        doc = parseYaml(String(buf));
      } catch (e) {
        errors.push({
          path: "schemas/openapi-commercial-v1.yaml",
          expected,
          actual: `YAML parse: ${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }
      const v = doc?.info?.version;
      const vs = v === undefined || v === null ? "" : String(v).trim();
      if (vs !== expected) {
        errors.push({ path: "schemas/openapi-commercial-v1.yaml (info.version)", expected, actual: vs || "(empty)" });
      }
    },
  };

  for (const [rel, check] of Object.entries(relPaths)) {
    const abs = path.join(root, rel);
    let buf;
    try {
      buf = readFileSync(abs, "utf8");
    } catch (e) {
      errors.push({
        path: rel,
        expected,
        actual: `read failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    check(buf);
  }

  if (errors.length > 0) {
    console.error("assert-version-integrity: one or more paths disagree with root package.json version.\n");
    for (const e of errors) {
      console.error(`  ${e.path}
    expected: ${e.expected}
    actual:   ${e.actual}\n`);
    }
    process.exit(1);
  }
  process.exit(0);
}

try {
  const expected = readCanonicalVersion();
  run(expected);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
