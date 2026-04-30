import type { TrustDecisionRecordIngest } from "@/lib/trustDecisionRecord.contract";

type OutcomeCertificateLike = {
  workflowId: string;
  runKind: "contract_sql" | "contract_sql_langgraph_checkpoint_trust" | "quick_preview";
  stateRelation: "matches_expectations" | "does_not_match" | "not_established";
  explanation: { details: Array<{ code: string; message: string }> };
  steps: Array<unknown>;
};

/**
 * Hosted enforcement blocked snapshot for funnel ingest (parity with POST /trust-decision-blocked shape).
 * `human_blocker_lines` satisfies fixed length-six contract for ingestion schema validators.
 */
export function buildHostedEnforcementTrustBlockRecord(input: {
  certificate: OutcomeCertificateLike;
  decisionReasonCode: string;
  attemptId: string;
}): TrustDecisionRecordIngest {
  const reasonCodes = [...new Set(input.certificate.explanation.details.map((d) => d.code))]
    .filter(Boolean)
    .slice(0, 24);

  const firstDetail = input.certificate.explanation.details[0];

  const highStakes =
    input.certificate.runKind === "quick_preview"
      ? ("prohibited" as const)
      : ("permitted" as const);

  const line0 = `[enforcement] workflow_id=${input.certificate.workflowId} attempt=${input.attemptId}`;
  const line1 = `reason=${input.decisionReasonCode}`;
  const line2 = firstDetail ? `${firstDetail.code}: ${firstDetail.message}` : "Hosted enforcement posture blocked continuation.";
  const line3 =
    "Remediation: reconcile database state or record drift acceptance per POST /api/v1/enforcement/accept contract.";
  const line4 = "Evidence: immutable enforcement_decision + governance_evidence linkage.";
  const line5 = `enforce_attempt_id=${input.attemptId}`;

  return {
    schema_version: 1,
    trust_decision: "unsafe",
    gate_kind: "contract_sql_irreversible",
    routing: { routing_key: `hosted_enforcement_attempt:${input.attemptId}` },
    certificate_snapshot: {
      schema_version: 1,
      workflow_id: input.certificate.workflowId,
      run_kind: input.certificate.runKind,
      state_relation: input.certificate.stateRelation,
      high_stakes_reliance: highStakes,
      reason_codes: reasonCodes.length ? reasonCodes : ["HOSTED_ENFORCEMENT_BLOCKED"],
      first_problem:
        input.certificate.steps.length >= 1 && firstDetail
          ? {
              seq: 0,
              tool_id: "hosted_enforcement",
              observed_trunc: firstDetail.message.slice(0, 512),
              expected_trunc: line1.slice(0, 512),
            }
          : null,
    },
    human_blocker_lines: [line0, line1, line2, line3, line4, line5],
  };
}
