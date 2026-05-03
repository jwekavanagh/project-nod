/**
 * Must match `AUTOMATION_BOUNDARY_CONNECTOR` in agentskeptic `src/remediationMessage.ts` (verify with grep).
 */
export const AUTOMATION_BOUNDARY_CONNECTOR =
  "Automation-safe here means retrying the same read-only verification (same events, registry, workflow, and read target) after a transient connector fault. It does not authorize changing application data, switching databases or workflows, or weakening verification policy." as const;
