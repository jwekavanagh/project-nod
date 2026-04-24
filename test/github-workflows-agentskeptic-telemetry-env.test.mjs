/**
 * Authoritative inventory: every workflow job in .github/workflows and AGENTSKEPTIC_TELEMETRY env rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadWorkflow(name) {
  const text = readFileSync(join(root, ".github", "workflows", name), "utf8");
  return parse(text);
}

describe("GitHub Actions AGENTSKEPTIC_TELEMETRY env", () => {
  it("ci.yml jobs match inventory", () => {
    const doc = loadWorkflow("ci.yml");
    const jobs = doc.jobs;
    const ids = Object.keys(jobs).sort();
    assert.deepEqual(ids, ["codeql", "commercial", "commitlint", "test", "vercel_production"]);
    assert.equal(jobs.test.env.AGENTSKEPTIC_TELEMETRY, "0");
    assert.equal(jobs.commercial.env.AGENTSKEPTIC_TELEMETRY, "0");
    assert.equal("AGENTSKEPTIC_TELEMETRY" in (jobs.codeql.env ?? {}), false);
    assert.equal(jobs.vercel_production.uses, "./.github/workflows/deploy-vercel.yml");
    assert.equal("AGENTSKEPTIC_TELEMETRY" in (jobs.vercel_production.env ?? {}), false);
  });

  it("assurance-scheduled.yml assurance job has telemetry env", () => {
    const doc = loadWorkflow("assurance-scheduled.yml");
    assert.equal(doc.jobs.assurance.env.AGENTSKEPTIC_TELEMETRY, "0");
  });

  it("release.yml jobs match inventory and telemetry env", () => {
    const doc = loadWorkflow("release.yml");
    const jobs = doc.jobs;
    const ids = Object.keys(jobs).sort();
    assert.deepEqual(ids, ["publish-pypi", "semantic-release"]);
    assert.equal(jobs["semantic-release"].env.AGENTSKEPTIC_TELEMETRY, "0");
    assert.equal(jobs["publish-pypi"].env.AGENTSKEPTIC_TELEMETRY, "0");
  });

  it("website.yml jobs match inventory and telemetry env", () => {
    const doc = loadWorkflow("website.yml");
    const jobs = doc.jobs;
    const ids = Object.keys(jobs).sort();
    assert.deepEqual(ids, ["gates", "scope", "should_publish_vercel", "vercel_production"]);
    assert.equal("AGENTSKEPTIC_TELEMETRY" in (jobs.scope.env ?? {}), false);
    assert.equal(jobs.gates.env.AGENTSKEPTIC_TELEMETRY, "0");
    assert.equal("AGENTSKEPTIC_TELEMETRY" in (jobs.should_publish_vercel.env ?? {}), false);
    assert.equal(jobs.vercel_production.uses, "./.github/workflows/deploy-vercel.yml");
    assert.equal(jobs.vercel_production.with?.agentskeptic_telemetry_zero, true);
  });

  it("deploy-vercel.yml has no static AGENTSKEPTIC_TELEMETRY in job env (set via GITHUB_ENV when needed)", () => {
    const doc = loadWorkflow("deploy-vercel.yml");
    assert.equal("AGENTSKEPTIC_TELEMETRY" in (doc.jobs.vercel.env ?? {}), false);
  });
});
