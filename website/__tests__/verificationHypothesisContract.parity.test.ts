import { productActivationRequestSchema } from "@/lib/funnelProductActivation.contract";
import {
  isValidVerificationHypothesisWireValue,
  normalizeVerificationHypothesisInput,
} from "agentskeptic/verificationHypothesisContract";
import { describe, expect, it } from "vitest";

function canonicalAcceptsWhenPresent(raw: string): boolean {
  const t = normalizeVerificationHypothesisInput(raw);
  if (t.length === 0) return false;
  return isValidVerificationHypothesisWireValue(t);
}

function v2StartedBase(runId: string) {
  return {
    event: "verify_started" as const,
    schema_version: 2 as const,
    run_id: runId,
    issued_at: new Date().toISOString(),
    workload_class: "non_bundled" as const,
    subcommand: "batch_verify" as const,
    build_profile: "oss" as const,
    telemetry_source: "unknown" as const,
  };
}

describe("verificationHypothesisContract parity vs productActivation Zod", () => {
  it("matches golden vectors when verification_hypothesis is present", () => {
    const cases: Array<{ raw: string; expectOk: boolean }> = [
      { raw: "Expect_crm_row_for_contact", expectOk: true },
      { raw: "  trimmed_ok  ", expectOk: true },
      { raw: "", expectOk: false },
      { raw: "   ", expectOk: false },
      { raw: `bad"quote`, expectOk: false },
      { raw: "bad'quote", expectOk: false },
      { raw: "x\ny", expectOk: false },
      { raw: "\t", expectOk: false },
      { raw: "a".repeat(241), expectOk: false },
    ];

    let i = 0;
    for (const { raw, expectOk } of cases) {
      const body = { ...v2StartedBase(`parity-run-${i++}`), verification_hypothesis: raw };
      const zodOk = productActivationRequestSchema.safeParse(body).success;
      expect(zodOk).toBe(expectOk);
      expect(canonicalAcceptsWhenPresent(raw)).toBe(expectOk);
    }
  });

  it("accepts v2 verify_started without verification_hypothesis key", () => {
    const body = v2StartedBase("parity-absent-hyp");
    expect(productActivationRequestSchema.safeParse(body).success).toBe(true);
  });
});
