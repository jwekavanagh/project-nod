import { formatOperationalMessage } from "./failureCatalog.js";
import type { FailureSpineV1 } from "./failureSpine.js";
import { AUTOMATION_BOUNDARY_CONNECTOR } from "./remediationMessage.js";

/** Single producer of the terminal `failure_spine:` human block (must match certificate.failureSpine). */
export function formatFailureSpineHuman(spine: FailureSpineV1): string {
  const summaryOneLine = formatOperationalMessage(spine.summary);
  const af = spine.actionableFailure;
  const primary = spine.primaryCodes.join(",");
  const lines = [
    "failure_spine:",
    `  trust_decision: ${spine.trustDecision}`,
    `  summary: ${summaryOneLine}`,
    `  actionable_failure: category=${af.category} severity=${af.severity} recommended_action=${af.recommendedAction} automation_safe=${af.automationSafe}`,
    `  primary_codes: ${primary}`,
    `  rerun_guidance: ${formatOperationalMessage(spine.rerunGuidance)}`,
  ];
  if (af.automationSafe && af.recommendedAction === "improve_read_connectivity") {
    lines.push(`  automation_boundary: ${AUTOMATION_BOUNDARY_CONNECTOR}`);
  }
  lines.push(`  source: ${spine.source}`);
  return lines.join("\n");
}
