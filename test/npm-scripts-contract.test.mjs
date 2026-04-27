/**
 * Enforces package.json + scripts/verify.mjs single-orchestrator shape.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const verifySrc = readFileSync(join(root, "scripts/verify.mjs"), "utf8");

describe("npm scripts contract (test / test:ci → verify.mjs)", () => {
  it("scripts.test / test:ci are verify one-liners", () => {
    assert.equal(pkg.scripts.test, "node scripts/verify.mjs --profile=default");
    assert.equal(pkg.scripts["test:ci"], "node scripts/verify.mjs --profile=ci");
  });

  it("shims delegate to verify --stages", () => {
    assert.equal(
      pkg.scripts["test:node:sqlite"],
      "node scripts/verify.mjs --stages=build,nodeGuards,nodeTestSqlite",
    );
    assert.equal(
      pkg.scripts["test:postgres"],
      "node scripts/verify.mjs --stages=nodeTestPostgres",
    );
  });

  it("test:workflow-truth-contract is a single verify stage (no mjs in package.json)", () => {
    assert.equal(
      pkg.scripts["test:workflow-truth-contract"],
      "node scripts/verify.mjs --stages=ciWorkflowTruthSingle",
    );
  });

  it("verify:decision-readiness uses the JSON gate", () => {
    assert.equal(
      pkg.scripts["verify:decision-readiness"],
      "node scripts/verify.mjs --profile=decision-readiness",
    );
  });

  it("verify.mjs: default profile runs commercialEnforce then rebuild; ci runs postgres tail after assurance", () => {
    const iC = verifySrc.indexOf("const profileDefault = [");
    const iD = verifySrc.indexOf("const profileCi = [");
    assert.ok(iC !== -1 && iD !== -1);
    const defaultBlock = verifySrc.slice(iC, iD);
    const jAss = defaultBlock.indexOf('"assurance"');
    const jCom = defaultBlock.indexOf('"commercialEnforce"');
    const jRe = defaultBlock.indexOf('"rebuildOss"');
    assert.ok(jAss < jCom && jCom < jRe, "default: assurance → commercialEnforce → rebuildOss");
    const ciBlock = verifySrc.slice(iD);
    const aAs = ciBlock.indexOf('"assurance"');
    const aPo = ciBlock.indexOf('"nodeTestPostgres"');
    assert.ok(
      aAs < aPo,
      "ci: nodeTestPostgres after assurance (no unflagged commercial before postgres)",
    );
  });

  it("verify.mjs: each profile includes exactly one validateTtfv stage", () => {
    const inArrays = (verifySrc.match(/"validateTtfv",/g) || []).length;
    assert.equal(inArrays, 2, "profileDefault and profileCi should each list validateTtfv");
  });
});
