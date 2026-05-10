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
- summary: Multi-effect step 2 failed: receipt_doc missing and http_receipt status mismatch.
- actionable_failure: category=`MULTI_EFFECT` severity=`high` recommended_action=`resolve_multi_effect_failures` automation_safe=`false`
- primary_codes: `HTTP_WITNESS_STATUS_MISMATCH,VECTOR_NOT_FOUND`
- rerun_guidance: Align multi-effect registry coverage or split steps so each effect is verifiable, then rerun verify.
- source: `workflow`

### Failing steps

| seq | scope | tool / effect | reason codes | recommended action |
| --- | --- | --- | --- | --- |
| 2 | effect | effect: receipt_doc | `VECTOR_NOT_FOUND` | Align multi-effect registry coverage or split steps so each effect is verifiable, then rerun verify. |
| 2 | effect | effect: http_receipt | `HTTP_WITNESS_STATUS_MISMATCH` | Restore read-only HTTP witness connectivity then rerun verify. |

### Coverage snapshot (claim counts; not modality coverage)

- checked_claims_count: `0`
- not_checked_claims_count: `0`
- missing_inputs_count: `1`

### Witness coverage

- exercised_modalities: `sql`, `vector_document`
- fully_satisfied_modalities: `sql`
- not_fully_satisfied_modalities: `vector_document`
- support_label: `coverage_incomplete_or_failed`

> `failing_witness_kinds` below is derived only from **failing** reason-code prefixes (legacy GitHub Actions output). It is **not** the same as modalities exercised on trusted runs.


- failing_witness_kinds: `http_witness`, `vector_document`

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
