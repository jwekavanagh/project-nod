/**
 * L0 integrate spine: structural contract (guard after demo, workflowId parity, clone URL default).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templatePath = join(root, "scripts", "templates", "integrate-activation-shell.bash");
const bootstrapJsonPath = join(root, "examples", "integrate-your-db", "bootstrap-input.json");

describe("integrate spine L0 contract", () => {
  it("has no AGENTSKEPTIC_VERIFY_DB guard before git clone", () => {
    const t = readFileSync(templatePath, "utf8");
    const cloneMatch = t.match(/\bgit\b[^\n]*\bclone\b/);
    assert.ok(cloneMatch, "template must contain a git … clone invocation");
    const cloneIdx = cloneMatch.index ?? -1;
    const guardIdx = t.indexOf("AGENTSKEPTIC_VERIFY_DB");
    assert.ok(guardIdx >= 0, "template must reference AGENTSKEPTIC_VERIFY_DB");
    assert.ok(guardIdx > cloneIdx, "AGENTSKEPTIC_VERIFY_DB guard must appear after git clone");
  });

  it("guard appears after first-run-verify and before integrate-your-db bootstrap", () => {
    const t = readFileSync(templatePath, "utf8");
    const frIdx = t.indexOf("npm run first-run-verify");
    const guardBlock = t.indexOf("if [ -z \"${AGENTSKEPTIC_VERIFY_DB:-}\" ]");
    const finalBootstrap = t.indexOf("examples/integrate-your-db/bootstrap-input.json");
    assert.ok(frIdx >= 0);
    assert.ok(guardBlock > frIdx, "guard must follow first-run-verify");
    assert.ok(finalBootstrap > guardBlock, "final bootstrap must follow guard");
  });

  it("uses INTEGRATE_SPINE_GIT_URL default expansion on clone line", () => {
    const t = readFileSync(templatePath, "utf8");
    assert.match(t, /\$\{INTEGRATE_SPINE_GIT_URL:-https:\/\/github\.com\/jwekavanagh\/agentskeptic\.git\}/);
  });

  it("uses mktemp -u for bootstrap --out paths so --out does not pre-exist", () => {
    const t = readFileSync(templatePath, "utf8");
    assert.match(t, /mktemp -u/);
    assert.ok(!t.includes('OUT="$(mktemp -d)"'), "must not pre-create --out with mktemp -d");
  });

  it("does not reference Postgres verify env in template", () => {
    const t = readFileSync(templatePath, "utf8");
    assert.equal(t.includes("AGENTSKEPTIC_VERIFY_POSTGRES_URL"), false);
  });

  it("workflowId in shell matches bootstrap-input.json", () => {
    const t = readFileSync(templatePath, "utf8");
    const j = JSON.parse(readFileSync(bootstrapJsonPath, "utf8"));
    const wid = j.workflowId;
    assert.ok(typeof wid === "string" && wid.length > 0);
    assert.match(t, new RegExp(`--workflow-id ${wid}\\b`));
    assert.equal(j.workflowId, "wf_integrate_spine");
  });
});
