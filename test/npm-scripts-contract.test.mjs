/**
 * Enforces package.json + scripts/verification-truth canonical gate shape.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const stagesSrc = readFileSync(join(root, "scripts", "verification-truth-stages.mjs"), "utf8");

const truth = "node scripts/verification-truth.mjs";

describe("npm scripts contract (verification:truth)", () => {
  it("scripts.test / test:ci / verification:truth are identical one-liners", () => {
    assert.equal(pkg.scripts["verification:truth"], truth);
    assert.equal(pkg.scripts.test, truth);
    assert.equal(pkg.scripts["test:ci"], truth);
  });

  it("shims use dedicated batch runners (no verify.mjs)", () => {
    assert.equal(
      pkg.scripts["test:node:sqlite"],
      "npm run build && node scripts/run-sqlite-node-test-batch.mjs",
    );
    assert.equal(pkg.scripts["test:postgres"], "node scripts/run-postgres-node-test-batch.mjs");
  });

  it("test:workflow-truth-contract runs postgres contract suite via shim", () => {
    assert.equal(pkg.scripts["test:workflow-truth-contract"], "node scripts/run-workflow-truth-contract.mjs");
  });

  it("verification-truth journey tail includes validateTtfv exactly once", () => {
    const matches = [...stagesSrc.matchAll(/"validateTtfv",/g)];
    assert.equal(matches.length, 1);
  });

  it("measureEmission appears once at end of profileCiTail", () => {
    const i = stagesSrc.indexOf("export const profileCiTail");
    assert.ok(i !== -1);
    const slice = stagesSrc.slice(i);
    const nMeasure = (slice.match(/"measureEmissionOnboarding"/g) || []).length;
    assert.equal(nMeasure, 1);
  });
});
