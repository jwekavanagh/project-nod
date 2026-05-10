## AgentSkeptic truth check

- mode: `check`
- cli_exit: `0`

- truth_check_verdict: `unknown`
- release_critical_truth_check_verdict: `trusted`
- state_relation: `not_established`
- high_stakes_reliance: `prohibited`

### Release-critical gate

- release_critical_truth_check_verdict: `trusted`

### Failure spine

- trust_decision: `unknown`
- summary: LangGraph checkpoint trust ineligible: no runnable verification trace.
- actionable_failure: category=`INELIGIBLE` severity=`low` recommended_action=`fix_event_ingest_and_steps` automation_safe=`false`
- primary_codes: `INGEST_NO_STRUCTURED_TOOL_ACTIVITY`
- rerun_guidance: Repair NDJSON capture so checkpoint trust receives schema-valid schemaVersion 3 tool_observed lines for this workflow, then rerun verify.
- source: `ineligible_langgraph`

### Failing steps

_(no failing steps)_


### Coverage snapshot (claim counts; not modality coverage)

- checked_claims_count: `0`
- not_checked_claims_count: `1`
- missing_inputs_count: `1`

### Witness coverage

- exercised_modalities: _(none)_
- fully_satisfied_modalities: _(none)_
- not_fully_satisfied_modalities: _(none)_
- support_label: `thin_or_unknown`

> `failing_witness_kinds` below is derived only from **failing** reason-code prefixes (legacy GitHub Actions output). It is **not** the same as modalities exercised on trusted runs.


- failing_witness_kinds: `sql`

### Outcome Certificate artifact

Download the canonical certificate from this run's **Artifacts** list:

- name: `agentskeptic-outcome-certificate`
- file: `outcome-certificate.json`
- written-to: `<ARTIFACT_DIR>/outcome-certificate.json`

<details><summary>CLI stderr (last 80 lines)</summary>

```text
truth_check_verdict: unknown
release_critical_truth_check_verdict: unknown
```

</details>
