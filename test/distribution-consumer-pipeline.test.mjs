/**
 * @typedef {{ databaseId: string, name: string, createdAt: string, status: string, conclusion: string | null }} GhRun
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildForeignSmokeWorkflowYaml,
  classifyPollTimeoutWithoutR,
  fixtureSha256FromFullYaml,
  githubCreatedAtToMs,
  parsePrimaryRepoFromAnchors,
  selectProofRun,
  stripForeignSmokeBodyForHash,
  validateProofJson,
} from "../scripts/distribution-consumer-pipeline.mjs";

describe("distribution-consumer-pipeline helpers", () => {
  it("stripForeignSmokeBodyForHash removes env block with FOREIGN_SMOKE_FIXTURE_SHA256", () => {
    const y = "jobs:\n  j:\n    runs-on: linux\n    env:\n      FOREIGN_SMOKE_FIXTURE_SHA256: \"abc\"\n    steps:\n      - run: echo\n";
    const s = stripForeignSmokeBodyForHash(y);
    assert.ok(!s.includes("FOREIGN_SMOKE_FIXTURE_SHA256"));
    assert.ok(s.includes("runs-on: linux"));
    assert.ok(s.includes("steps:"));
  });

  it("fixtureSha256FromFullYaml matches injected workflow", () => {
    const primary = { owner: "o", repo: "r" };
    const { yaml, fixtureSha256 } = buildForeignSmokeWorkflowYaml(primary);
    assert.equal(fixtureSha256FromFullYaml(yaml), fixtureSha256);
    assert.ok(yaml.includes("run-name: distribution-consumer-${{ inputs.correlation_id }}"));
    assert.ok(yaml.includes("FOREIGN_SMOKE_FIXTURE_SHA256:"));
    assert.ok(yaml.includes(`"${fixtureSha256}"`));
  });

  it("parsePrimaryRepoFromAnchors reads github.com URL", () => {
    const p = parsePrimaryRepoFromAnchors({
      gitRepositoryUrl: "https://github.com/acme/widget.git",
    });
    assert.deepEqual(p, { owner: "acme", repo: "widget" });
  });

  it("selectProofRun picks newest createdAt then highest databaseId", () => {
    const t0 = 1_700_000_000_000;
    const iso = (ms) => new Date(ms).toISOString();
    const name = "distribution-consumer-x";
    /** @type {GhRun[]} */
    const runs = [
      {
        databaseId: "10",
        name,
        createdAt: iso(t0),
        status: "completed",
        conclusion: "success",
      },
      {
        databaseId: "20",
        name,
        createdAt: iso(t0),
        status: "completed",
        conclusion: "success",
      },
      {
        databaseId: "30",
        name,
        createdAt: iso(t0 + 1),
        status: "completed",
        conclusion: "success",
      },
    ];
    const r = selectProofRun(runs, name, t0 - 10_000);
    assert.equal(r?.databaseId, "30");
  });

  it("selectProofRun ignores failed older run", () => {
    const t0 = 1_710_000_000_000;
    const iso = (ms) => new Date(ms).toISOString();
    const name = "distribution-consumer-y";
    const picked = selectProofRun(
      [
        {
          databaseId: "1",
          name,
          createdAt: iso(t0),
          status: "completed",
          conclusion: "failure",
        },
        {
          databaseId: "2",
          name,
          createdAt: iso(t0 + 1),
          status: "completed",
          conclusion: "success",
        },
      ],
      name,
      t0 - 5_000,
    );
    assert.equal(picked?.databaseId, "2");
  });

  it("selectProofRun returns null when only stale wrong-name successes in window", () => {
    const t0 = 1_720_000_000_000;
    const iso = (ms) => new Date(ms).toISOString();
    const picked = selectProofRun(
      [
        {
          databaseId: "1",
          name: "other",
          createdAt: iso(t0),
          status: "completed",
          conclusion: "success",
        },
      ],
      "distribution-consumer-z",
      t0 - 1_000,
    );
    assert.equal(picked, null);
  });

  it("classifyPollTimeoutWithoutR: stale precedence", () => {
    assert.equal(
      classifyPollTimeoutWithoutR({ cEmptyEveryPoll: true, sawInWindowSuccessWrongName: true }),
      "STALE_SUCCESS_IGNORED",
    );
    assert.equal(
      classifyPollTimeoutWithoutR({ cEmptyEveryPoll: true, sawInWindowSuccessWrongName: false }),
      "NO_RUN_WITHIN_POLL",
    );
    assert.equal(
      classifyPollTimeoutWithoutR({ cEmptyEveryPoll: false, sawInWindowSuccessWrongName: true }),
      "NO_RUN_WITHIN_POLL",
    );
  });

  it("githubCreatedAtToMs parses ISO", () => {
    assert.equal(githubCreatedAtToMs("2024-01-02T03:04:05.000Z"), Date.parse("2024-01-02T03:04:05.000Z"));
  });

  it("validateProofJson field mismatches", () => {
    const exp = { correlationId: "a", verifierSha: "b", fixtureSha256: "c" };
    assert.equal(validateProofJson(null, exp), "PROOF_ARTIFACT_MISMATCH");
    assert.equal(
      validateProofJson(
        { correlation_id: "x", verifier_sha: "b", foreign_smoke_fixture_sha256: "c" },
        exp,
      ),
      "CORRELATION_PROOF_MISMATCH",
    );
    assert.equal(
      validateProofJson(
        { correlation_id: "a", verifier_sha: "x", foreign_smoke_fixture_sha256: "c" },
        exp,
      ),
      "VERIFIER_SHA_PROOF_MISMATCH",
    );
    assert.equal(
      validateProofJson(
        { correlation_id: "a", verifier_sha: "b", foreign_smoke_fixture_sha256: "x" },
        exp,
      ),
      "FIXTURE_HASH_PROOF_MISMATCH",
    );
    assert.equal(
      validateProofJson(
        { correlation_id: "a", verifier_sha: "b", foreign_smoke_fixture_sha256: "c" },
        exp,
      ),
      null,
    );
  });
});
