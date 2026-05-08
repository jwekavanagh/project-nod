## AgentSkeptic truth check

- mode: `check`
- cli_exit: `0`

- truth_check_verdict: `trusted`
- release_critical_truth_check_verdict: `trusted`
- state_relation: `matches_expectations`
- high_stakes_reliance: `permitted`

### Release-critical gate

- release_critical_truth_check_verdict: `trusted`

### Failure spine

- trust_decision: `safe`
- summary: All LangGraph checkpoints verified against database state.
- actionable_failure: category=`VERIFIED` severity=`none` recommended_action=`none` automation_safe=`true`
- primary_codes: `VERIFIED`
- rerun_guidance: No further verification action is required for this outcome under the configured rules.
- source: `workflow`

### Failing steps

_(no failing steps)_


- failing_witness_kinds: _(none)_

### LangGraph checkpoint verdicts

| checkpoint | verdict | seqs | production meaning |
| --- | --- | --- | --- |
| thread:42:checkpoint:1 | `verified` | 0,1 | Invoice search step was reached and produced the expected fetch. |
| thread:42:checkpoint:2 | `verified` | 2 | Final answer was produced from verified context. |

### Outcome Certificate artifact

Download the canonical certificate from this run's **Artifacts** list:

- name: `agentskeptic-outcome-certificate`
- file: `outcome-certificate.json`
- written-to: `<ARTIFACT_DIR>/outcome-certificate.json`

<details><summary>CLI stderr (last 80 lines)</summary>

```text
truth_check_verdict: trusted
release_critical_truth_check_verdict: trusted
```

</details>
