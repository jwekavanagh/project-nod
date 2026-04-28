/**
 * Contract: release automation wiring (.releaserc.cjs, workflows, summarizer, release-preview).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadWorkflowYaml(name) {
  const text = readFileSync(join(root, ".github", "workflows", name), "utf8");
  return parse(text);
}

describe("release workflow contract", () => {
  it("ci.yml top-level name is CI (required for release.yml workflow_run trigger)", () => {
    const doc = loadWorkflowYaml("ci.yml");
    assert.equal(doc.name, "CI");
  });

  it("release.yml workflow_run lists exactly CI (must match ci.yml name: field)", () => {
    const doc = loadWorkflowYaml("release.yml");
    const workflows = doc.on.workflow_run.workflows;
    assert.ok(Array.isArray(workflows), "on.workflow_run.workflows must be an array");
    assert.deepEqual(workflows, ["CI"]);
  });

  it("uses .releaserc.cjs and not .releaserc.json", () => {
    assert.equal(existsSync(join(root, ".releaserc.cjs")), true);
    assert.equal(existsSync(join(root, ".releaserc.json")), false);
  });

  it("release.yml wraps semantic-release with release-outcome-summarize.mjs", () => {
    const yml = readFileSync(join(root, ".github", "workflows", "release.yml"), "utf8");
    assert.ok(yml.includes("release-outcome-summarize.mjs"));
    assert.ok(yml.includes("tee semantic-release.log"));
  });

  it("ci.yml has release-preview, verification job, and verification:truth step", () => {
    const yml = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
    assert.ok(yml.includes("release-preview:"));
    assert.ok(yml.includes("name: Release preview"));
    assert.ok(yml.includes("name: verification"));
    assert.ok(yml.includes("npm run verification:truth"));
    assert.ok(yml.includes("scripts/release-preview.mjs --event"));
    assert.equal(yml.includes("name: test"), false);
    assert.equal(yml.includes("name: commercial"), false);
  });

  it("release-outcome-summarize.mjs contains RELEASE_OUTCOME=", () => {
    const src = readFileSync(join(root, "scripts", "release-outcome-summarize.mjs"), "utf8");
    assert.ok(src.includes("RELEASE_OUTCOME="));
  });

  it("publish-pypi has Verify distribution step (T6)", () => {
    const yml = readFileSync(join(root, ".github", "workflows", "release.yml"), "utf8");
    assert.ok(yml.includes("node scripts/verify-release-distribution.mjs"));
    assert.ok(yml.includes("GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}"));
    assert.ok(yml.includes("Verify distribution"));
  });
});
