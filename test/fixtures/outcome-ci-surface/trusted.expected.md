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
- summary: All checks matched expectations; trust decision is safe.
- actionable_failure: category=`VERIFIED` severity=`none` recommended_action=`none` automation_safe=`true`
- primary_codes: `VERIFIED`
- rerun_guidance: No further verification action is required for this outcome under the configured rules.
- source: `workflow`

### Failing steps

_(no failing steps)_


### Coverage snapshot

- checked_claims_count: `1`
- not_checked_claims_count: `0`
- missing_inputs_count: `1`

- failing_witness_kinds: _(none)_

### Outcome Certificate artifact

Download the canonical certificate from this run's **Artifacts** list:

- name: `agentskeptic-outcome-certificate`
- file: `outcome-certificate.json`
- written-to: `<ARTIFACT_DIR>/outcome-certificate.json`

<details><summary>CLI stderr (last 80 lines)</summary>

```text
truth_check_verdict: trusted
release_critical_truth_check_verdict: trusted
human line
```

</details>
