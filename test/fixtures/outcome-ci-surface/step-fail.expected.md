## AgentSkeptic truth check

- mode: `check`
- cli_exit: `0`

- truth_check_verdict: `not_trusted`
- release_critical_truth_check_verdict: `trusted`
- state_relation: `does_not_match`
- high_stakes_reliance: `prohibited`

### Release-critical gate

- release_critical_truth_check_verdict: `trusted`

### Failure spine

- trust_decision: `unsafe`
- summary: Declared step 1 (orders.insert) did not verify against observed database state.
- actionable_failure: category=`DOWNSTREAM_STATE` severity=`high` recommended_action=`reconcile_downstream_state` automation_safe=`false`
- primary_codes: `OBJECT_MISSING,STATE_MISMATCH`
- rerun_guidance: Fix downstream database or service state to match declared expectations, then rerun verify.
- source: `workflow`

### Failing steps

| seq | scope | tool / effect | reason codes | recommended action |
| --- | --- | --- | --- | --- |
| 1 | step | orders.insert | `STATE_MISMATCH`, `OBJECT_MISSING` | Fix downstream database or service state to match declared expectations, then rerun verify. |

### Coverage snapshot (claim counts; not modality coverage)

- checked_claims_count: `1`
- not_checked_claims_count: `1`
- missing_inputs_count: `1`

### Witness coverage

- exercised_modalities: `sql`
- fully_satisfied_modalities: _(none)_
- not_fully_satisfied_modalities: `sql`
- support_label: `coverage_incomplete_or_failed`

> `failing_witness_kinds` below is derived only from **failing** reason-code prefixes (legacy GitHub Actions output). It is **not** the same as modalities exercised on trusted runs.


- failing_witness_kinds: `object_storage`, `sql`

### Outcome Certificate artifact

Download the canonical certificate from this run's **Artifacts** list:

- name: `agentskeptic-outcome-certificate`
- file: `outcome-certificate.json`
- written-to: `<ARTIFACT_DIR>/outcome-certificate.json`

<details><summary>CLI stderr (last 80 lines)</summary>

```text
truth_check_verdict: not_trusted
release_critical_truth_check_verdict: trusted
```

</details>
