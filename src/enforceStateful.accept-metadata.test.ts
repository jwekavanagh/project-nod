import { describe, expect, it } from "vitest";
import { applyAcceptDriftEnvToPayload } from "./enforceStateful.js";
import { TruthLayerError } from "./truthLayerError.js";

describe("applyAcceptDriftEnvToPayload", () => {
  it("throws when acceptance_reason or acceptance_owner missing", () => {
    const payload: Record<string, unknown> = {};
    expect(() =>
      applyAcceptDriftEnvToPayload(payload, {
        AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH: "abc",
        AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION: "3",
        AGENTSKEPTIC_ACCEPT_OWNER: "o@example.com",
      } as NodeJS.ProcessEnv),
    ).toThrow(TruthLayerError);
    try {
      applyAcceptDriftEnvToPayload(payload, {
        AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH: "abc",
        AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION: "3",
        AGENTSKEPTIC_ACCEPT_OWNER: "o@example.com",
      } as NodeJS.ProcessEnv);
    } catch (e) {
      expect(e).toBeInstanceOf(TruthLayerError);
      expect((e as TruthLayerError).message).toContain("AGENTSKEPTIC_ACCEPT_REASON");
    }
  });

  it("fills governed fields and optional links / review_by", () => {
    const payload: Record<string, unknown> = {};
    applyAcceptDriftEnvToPayload(payload, {
      AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH: "hashpin",
      AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION: "7",
      AGENTSKEPTIC_ACCEPT_REASON: "Known outage",
      AGENTSKEPTIC_ACCEPT_OWNER: "oncall@example.com",
      AGENTSKEPTIC_ACCEPT_REVIEW_BY: "2031-01-01T00:00:00.000Z",
      AGENTSKEPTIC_ACCEPT_EVIDENCE_LINKS: JSON.stringify(["https://example.com/t/1"]),
    } as NodeJS.ProcessEnv);
    expect(payload.expected_projection_hash).toBe("hashpin");
    expect(payload.lifecycle_state_version).toBe(7);
    expect(payload.acceptance_reason).toBe("Known outage");
    expect(payload.acceptance_owner).toBe("oncall@example.com");
    expect(payload.exception_review_by).toBe("2031-01-01T00:00:00.000Z");
    expect(payload.evidence_links).toEqual(["https://example.com/t/1"]);
  });
});
