/**
 * Sole user-visible rerun / remediation line text per RecommendedActionCode (SSOT).
 */

import type { RecommendedActionCode } from "./types.js";

const REMEDIATION_BY_CODE: Record<RecommendedActionCode, string> = {
  none: "No further verification action is required for this outcome under the configured rules.",
  manual_review: "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.",
  deduplicate: "Resolve duplicate or conflicting rows that matched the same verification key, then rerun verify.",
  reconcile_downstream_state: "Fix downstream database or service state to match declared expectations, then rerun verify.",
  correct_verification_inputs: "Correct registry, events, or tool parameters so expectations resolve, then rerun verify.",
  improve_read_connectivity: "Restore read-only database or witness connectivity and credentials, then rerun verify.",
  resolve_multi_effect_failures: "Align multi-effect registry coverage or split steps so each effect is verifiable, then rerun verify.",
  align_tool_observations: "Align repeated tool observations so canonical params agree, then rerun verify.",
  fix_event_ingest_and_steps: "Repair NDJSON event capture so each line is schema-valid tool_observed for this workflow, then rerun verify.",
  fix_event_sequence_order: "Fix capture ordering or timestamps so the event sequence is coherent, then rerun verify.",
  fix_run_context_controls: "Fix model/retrieval/control ordering so observations are fairly evaluated, then rerun verify.",
  fix_cli_usage: "Fix CLI flags or paths (events, registry, database URL), then rerun verify.",
  fix_registry_events_or_compare_files: "Align registry JSON with events and database, then rerun verify.",
  fix_verification_database_connection:
    "Point verify at a reachable read-only database URL (not SQLite file mode for remote witnesses), then rerun verify.",
  fix_saved_workflow_json: "Repair saved workflow JSON used for compare or replay, then rerun verify.",
  fix_compare_workflow_inputs: "Fix compare inputs so both runs are compatible, then rerun compare.",
  fix_execution_trace_structure: "Repair execution trace structure used for analysis, then retry.",
  fix_verification_policy_and_hook: "Adjust verification policy timing or hooks, then rerun verify.",
  fix_plan_document_and_patterns: "Fix plan document patterns referenced by plan-transition verification.",
  fix_plan_transition_cli_and_refs: "Fix plan-transition CLI arguments and git refs, then rerun.",
  upgrade_git_or_retry_git: "Upgrade git tooling or retry after git transient errors.",
};

export function remediationMessageForRecommendedAction(code: RecommendedActionCode): string {
  return REMEDIATION_BY_CODE[code] ?? REMEDIATION_BY_CODE.manual_review;
}
