import type { EvidenceCompletenessJson } from "./evidenceCompleteness.js";
import { redactEvidenceString } from "./redactEvidenceString.js";

/** Mirrors certificate `runKind` (avoid importing outcomeCertificate — circular). */
export type EvidenceCompletenessRunKind =
  | "contract_sql"
  | "contract_sql_langgraph_checkpoint_trust"
  | "quick_preview";

export const EVIDENCE_COMPLETENESS_BEGIN = "=== evidence_completeness ===" as const;
export const EVIDENCE_COMPLETENESS_END = "=== end evidence_completeness ===" as const;

/** Max body lines between anchors (excluding boundary lines). */
export const EVIDENCE_COMPLETENESS_MAX_LINES = 22 as const;

export function formatEvidenceCompletenessHuman(
  ec: EvidenceCompletenessJson,
  ctx: { runKind: EvidenceCompletenessRunKind; highStakesReliance: "permitted" | "prohibited" },
): string {
  const lines: string[] = [EVIDENCE_COMPLETENESS_BEGIN];
  lines.push(`Blocker: ${ec.blockerCategory}`);
  lines.push(`Quick signal: ${ec.quickSignal}`);
  if (ec.verifiedClaims.length > 0) {
    lines.push("Verified:");
    for (const v of ec.verifiedClaims.slice(0, 8)) {
      if (lines.length >= 1 + EVIDENCE_COMPLETENESS_MAX_LINES) break;
      lines.push(`  - ${v}`);
    }
  }
  if (ec.unverifiedClaims.length > 0) {
    lines.push("Not verified:");
    for (const v of ec.unverifiedClaims.slice(0, 8)) {
      if (lines.length >= 1 + EVIDENCE_COMPLETENESS_MAX_LINES) break;
      lines.push(`  - ${v}`);
    }
  }
  if (ec.missingInputs.length > 0) {
    lines.push("Missing input:");
    for (const m of ec.missingInputs.slice(0, 4)) {
      if (lines.length >= 1 + EVIDENCE_COMPLETENESS_MAX_LINES) break;
      lines.push(`  - ${m.code}: ${m.hint}`);
    }
  }
  lines.push("Next:");
  for (const n of ec.nextActions) {
    if (lines.length >= 1 + EVIDENCE_COMPLETENESS_MAX_LINES) break;
    lines.push(`  - ${n.text}`);
  }
  lines.push(
    `Trust boundary: runKind=${ctx.runKind} highStakesReliance=${ctx.highStakesReliance} (see certificate fields for normative meaning).`,
  );
  while (lines.length > 1 + EVIDENCE_COMPLETENESS_MAX_LINES) {
    lines.pop();
  }
  lines.push(EVIDENCE_COMPLETENESS_END);
  return lines.map((l) => redactEvidenceString(l, 2048)).join("\n");
}
