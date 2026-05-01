/**
 * Regression: commit messages must classify the same locally as in semantic-release CI.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { analyzeCommits } from "@semantic-release/commit-analyzer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pluginConfig = require(join(root, "release", "commit-analyzer-rules.cjs"));

function silentLogger() {
  return { log() {}, error() {} };
}

/**
 * @param {string} message
 * @returns {Promise<string | null>}
 */
async function classify(message) {
  return analyzeCommits(pluginConfig, {
    commits: [{ hash: "contract", message }],
    logger: silentLogger(),
    cwd: root,
  });
}

describe("release/commit-analyzer-rules.cjs (explicit conventionalcommits)", () => {
  it("feat: x → minor", async () => {
    assert.equal(await classify("feat: add capability"), "minor");
  });

  it("fix: x → patch", async () => {
    assert.equal(await classify("fix: handle edge case"), "patch");
  });

  it("feat!: x → major (breaking shorthand)", async () => {
    assert.equal(await classify("feat!: remove legacy API surface"), "major");
  });

  it("feat: x plus footer BREAKING CHANGE → major", async () => {
    const msg = "feat: redesign surface\n\nBREAKING CHANGE: incompatible verification contract.";
    assert.equal(await classify(msg), "major");
  });

  it("squash merge shape like PR #42 (feat!: + inline BREAKING in body) → major", async () => {
    const msg = `feat!: trust-lean OSS v4 kernel and website-owned registry draft

Squash-merge v4 OSS trust-lean work. BREAKING CHANGE: see CHANGELOG 4.0.0 entry.`;
    assert.equal(await classify(msg), "major");
  });

  it("non-conventional subjects do not classify for release", async () => {
    assert.strictEqual(await classify("tweak things"), null);
    assert.strictEqual(await classify("docs tweaks without conventional prefix"), null);
  });
});
