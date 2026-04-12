export const DEMO_SCENARIO_IDS = ["wf_complete", "wf_missing", "wf_inconsistent"] as const;
export type DemoScenarioId = (typeof DEMO_SCENARIO_IDS)[number];

/** Human labels for the homepage Try-it control; wire values stay `DEMO_SCENARIO_IDS`. */
export const DEMO_SCENARIO_PRESENTATION: Record<
  DemoScenarioId,
  { label: string; oneLiner: string }
> = {
  wf_complete: {
    label: "Happy path — row matches",
    oneLiner: "Structured tool activity matches the persisted row; workflow completes as verified.",
  },
  wf_missing: {
    label: "Green trace, missing row",
    oneLiner: "Trace-shaped success story but the expected row is absent (ROW_ABSENT).",
  },
  wf_inconsistent: {
    label: "Row present, values wrong",
    oneLiner: "A row exists but observed SQL does not match expectations under registry rules.",
  },
};
