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
