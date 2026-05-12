import { describe, expect, it } from "vitest";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import { parseAcceptEvidenceInput } from "@/lib/enforcementState";

const frozen = new Date("2030-01-15T12:00:00.000Z");

function acceptBody(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 3,
    run_id: "run-1",
    workflow_id: hostedFixture.outcome_certificate.workflowId,
    material_truth_sha256: hostedFixture.material_truth_sha256,
    certificate_sha256: hostedFixture.certificate_sha256,
    expected_projection_hash: "hashpin",
    lifecycle_state_version: 1,
    acceptance_reason: "Known migration window",
    acceptance_owner: "release-manager@example.com",
    outcome_certificate: hostedFixture.outcome_certificate,
    ...overrides,
  };
}

describe("parseAcceptEvidenceInput governed fields", () => {
  it("rejects missing acceptance_reason", () => {
    const b = acceptBody();
    delete (b as Record<string, unknown>).acceptance_reason;
    const r = parseAcceptEvidenceInput(b, { now: frozen });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("acceptance_reason");
  });

  it("rejects missing acceptance_owner", () => {
    const b = acceptBody();
    delete (b as Record<string, unknown>).acceptance_owner;
    const r = parseAcceptEvidenceInput(b, { now: frozen });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("acceptance_owner");
  });

  it("accepts minimal reason+owner", () => {
    const r = parseAcceptEvidenceInput(acceptBody(), { now: frozen });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.acceptance_reason).toBe("Known migration window");
      expect(r.input.acceptance_owner).toBe("release-manager@example.com");
      expect(r.input.evidence_links).toBeUndefined();
      expect(r.input.exception_review_by).toBeUndefined();
    }
  });

  it("rejects non-https evidence link", () => {
    const r = parseAcceptEvidenceInput(
      acceptBody({ evidence_links: ["http://evil.example/x"] }),
      { now: frozen },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("https");
  });

  it("accepts https evidence links", () => {
    const r = parseAcceptEvidenceInput(
      acceptBody({ evidence_links: ["https://linear.app/example/issue/1"] }),
      { now: frozen },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.evidence_links).toEqual(["https://linear.app/example/issue/1"]);
  });

  it("rejects exception_review_by in the past", () => {
    const r = parseAcceptEvidenceInput(
      acceptBody({ exception_review_by: "2020-01-01T00:00:00.000Z" }),
      { now: frozen },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("future");
  });

  it("accepts future exception_review_by", () => {
    const r = parseAcceptEvidenceInput(
      acceptBody({ exception_review_by: "2031-06-01T00:00:00.000Z" }),
      { now: frozen },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.exception_review_by?.toISOString()).toBe("2031-06-01T00:00:00.000Z");
    }
  });
});
