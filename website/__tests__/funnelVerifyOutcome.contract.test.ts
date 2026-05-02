import { describe, expect, it } from "vitest";
import { verifyOutcomeRequestSchema } from "@/lib/funnelVerifyOutcome.contract";

const activateStages = [
  { id: "ingest_input", status: "complete", trust_label: "n_a" },
  { id: "provisional_infer", status: "complete", trust_label: "provisional_pass" },
  { id: "contract_verify", status: "complete", trust_label: "decision_ready" },
  { id: "proof_export", status: "complete", trust_label: "decision_ready" },
] as const;

const baseBody = {
  schema_version: 3 as const,
  run_id: "run-test",
  workflow_id: "wf_t",
  trust_decision: "safe" as const,
  evidence_gap_primary: "none" as const,
  reason_codes: ["A"] as string[],
  terminal_status: "complete" as const,
  workload_class: "non_bundled" as const,
};

describe("verifyOutcomeRequestSchema", () => {
  it("rejects activate without activation", () => {
    const r = verifyOutcomeRequestSchema.safeParse({ ...baseBody, subcommand: "activate" });
    expect(r.success).toBe(false);
  });

  it("rejects batch_verify with activation present", () => {
    const r = verifyOutcomeRequestSchema.safeParse({
      ...baseBody,
      subcommand: "batch_verify",
      activation: { trust_terminal: "decision_ready", stages: [...activateStages] },
    });
    expect(r.success).toBe(false);
  });

  it("accepts well-formed activate payload", () => {
    const r = verifyOutcomeRequestSchema.safeParse({
      ...baseBody,
      subcommand: "activate",
      activation: { trust_terminal: "decision_ready", stages: [...activateStages] },
    });
    expect(r.success).toBe(true);
  });

  it("accepts legacy batch_verify without activation", () => {
    const r = verifyOutcomeRequestSchema.safeParse({ ...baseBody, subcommand: "batch_verify" });
    expect(r.success).toBe(true);
  });
});
