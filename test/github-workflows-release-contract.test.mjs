/**
 * Contract: release automation wiring (.releaserc.cjs, workflows, summarizer, release-preview).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("release workflow contract", () => {
  it("uses .releaserc.cjs and not .releaserc.json", () => {
    assert.equal(existsSync(join(root, ".releaserc.cjs")), true);
    assert.equal(existsSync(join(root, ".releaserc.json")), false);
  });

  it("release.yml wraps semantic-release with release-outcome-summarize.mjs", () => {
    const yml = readFileSync(join(root, ".github", "workflows", "release.yml"), "utf8");
    assert.ok(yml.includes("release-outcome-summarize.mjs"));
    assert.ok(yml.includes("tee semantic-release.log"));
  });

  it("ci.yml has release-preview job and stable job names", () => {
    const yml = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
    assert.ok(yml.includes("release-preview:"));
    assert.ok(yml.includes("name: Release preview"));
    assert.ok(yml.includes("name: test"));
    assert.ok(yml.includes("name: commercial"));
    assert.ok(yml.includes("scripts/release-preview.mjs --event"));
  });

  it("release-outcome-summarize.mjs contains RELEASE_OUTCOME=", () => {
    const src = readFileSync(join(root, "scripts", "release-outcome-summarize.mjs"), "utf8");
    assert.ok(src.includes("RELEASE_OUTCOME="));
  });
});
