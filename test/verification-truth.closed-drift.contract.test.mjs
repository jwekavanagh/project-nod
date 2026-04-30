/**
 * Merge gate prelude contract: manifest schema valid, git path specs cover codegen writers,
 * and closed drift roster matches scripts/enumerate-drift-artifacts.mjs enumerator (sorted lexicographically).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import picomatch from "picomatch";
import { CLOSED_DRIFT_ARTIFACT_REL_PATHS } from "../scripts/enumerate-drift-artifacts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const EMIT_SRC = join(root, "scripts", "emit-primary-marketing.cjs");

function extractJoinRootPaths(filePath) {
  const content = readFileSync(filePath, "utf8");
  const out = new Set();
  const re = /join\s*\(\s*ROOT\s*,\s*["']([^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    out.add(m[1].replace(/\\/g, "/"));
  }
  return [...out];
}

function pathspecCoversRelative(rel, gitPathspecs) {
  const normalized = rel.replace(/\\/g, "/");
  for (const spec of gitPathspecs) {
    const s = spec.replace(/\\/g, "/");
    if (s.endsWith("/")) {
      const p = s.slice(0, -1);
      if (normalized === p || normalized.startsWith(`${p}/`)) return true;
    } else if (!s.includes("*") && !s.includes("?") && !s.includes("[")) {
      if (normalized === s) return true;
      const asDir = `${s}/`;
      if (normalized.startsWith(asDir)) return true;
    } else {
      const pm = picomatch(s, { dot: true });
      if (pm(normalized)) return true;
    }
  }
  return false;
}

describe("verification-truth closed drift + pathspec contract", () => {
  it("manifest validates against JSON Schema", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "schemas", "ci", "verification-truth.manifest.json"), "utf8"),
    );
    const schema = JSON.parse(
      readFileSync(join(root, "schemas", "ci", "verification-truth.manifest.schema.json"), "utf8"),
    );
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    addFormats(ajv);
    const ok = ajv.validate(schema, manifest);
    assert.equal(ok, true, ajv.errors ? JSON.stringify(ajv.errors, null, 2) : "");
  });

  it("gating.closedDriftPaths matches enumerator CLOSED_DRIFT_ARTIFACT_REL_PATHS (sorted)", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "schemas", "ci", "verification-truth.manifest.json"), "utf8"),
    );
    const want = [...CLOSED_DRIFT_ARTIFACT_REL_PATHS];
    const got = manifest.gating?.closedDriftPaths ?? [];
    assert.deepEqual(got, want, "Update manifest or enumerator; lists must stay byte-for-byte aligned.");
  });

  it("emit-primary-marketing join(ROOT,…) targets are covered by gitPathspecs", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "schemas", "ci", "verification-truth.manifest.json"), "utf8"),
    );
    const rels = extractJoinRootPaths(EMIT_SRC);
    const gitPathspecs = manifest.gating.gitPathspecs;
    const missing = [];
    for (const rel of rels) {
      if (!pathspecCoversRelative(rel, gitPathspecs)) {
        missing.push(rel);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `Add these to schemas/ci/verification-truth.manifest.json gating.gitPathspecs (or widen a prefix): ${missing.join(", ")}`,
    );
  });

  it("sync-website-ssot targets are covered", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "schemas", "ci", "verification-truth.manifest.json"), "utf8"),
    );
    const ssot = readFileSync(join(root, "scripts", "sync-website-ssot.mjs"), "utf8");
    assert.ok(
      ssot.includes("sync:public-product-anchors"),
      "sync-website-ssot must invoke public product anchors",
    );
    const gitPathspecs = manifest.gating.gitPathspecs;
    const required = [
      "website/src/generated/integratorDocsEmbedded.ts",
      "website/src/generated/epistemicContractIntegrator.ts",
    ];
    for (const rel of required) {
      assert.equal(pathspecCoversRelative(rel, gitPathspecs), true, `missing pathspec for ${rel}`);
    }
  });
});
