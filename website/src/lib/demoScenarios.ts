export const DEMO_SCENARIO_IDS = [
  "wf_missing",
  "wf_complete",
  "wf_partial",
  "wf_inconsistent",
  "wf_duplicate_rows",
  "wf_unknown_tool",
  "wf_dup_seq",
  "wf_divergent_retry",
] as const;

export type DemoScenarioId = (typeof DEMO_SCENARIO_IDS)[number];

export function isDemoScenarioId(s: string): s is DemoScenarioId {
  return (DEMO_SCENARIO_IDS as readonly string[]).includes(s);
}

/** Human labels for the homepage Try-it control; wire values stay `DEMO_SCENARIO_IDS`. */
export const DEMO_SCENARIO_PRESENTATION: Record<
  DemoScenarioId,
  { label: string; oneLiner: string }
> = {
  wf_missing: {
    label: "Missing write (recommended first try)",
    oneLiner:
      "The agent reported a side effect, but the expected row is still absent under registry rules (ROW_ABSENT).",
  },
  wf_complete: {
    label: "Happy path — everything matches",
    oneLiner: "Structured tool activity matches the persisted row; workflow completes as verified.",
  },
  wf_partial: {
    label: "Partial multi-effect (one effect fails)",
    oneLiner:
      "A multi-step effect expected two rows; one satisfied and one did not (partial multi-effect under registry rules).",
  },
  wf_inconsistent: {
    label: "Stale data — row exists, values wrong",
    oneLiner: "A row exists but observed data does not match expectations under your registry rules.",
  },
  wf_duplicate_rows: {
    label: "Ambiguous data — more than one matching row",
    oneLiner: "Verification could not disambiguate the row because multiple records matched the target identity.",
  },
  wf_unknown_tool: {
    label: "Unknown tool in registry",
    oneLiner: "The event references a tool id that is not present in the shipped registry; verification cannot run.",
  },
  wf_dup_seq: {
    label: "Duplicate event sequence (same seq seen twice)",
    oneLiner:
      "The bundled stream includes duplicate `seq` values; read the human report for how the engine resolves this under policy.",
  },
  wf_divergent_retry: {
    label: "Divergent retries (same tool, different outcomes)",
    oneLiner:
      "Multiple observations for the same tool step disagree on recorded parameters; the stream is not coherent.",
  },
};
