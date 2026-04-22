# KERNEL_PORT_MAP (TS → Python)

| TypeScript | Python |
|------------|--------|
| `src/jsonPointer.ts` | `agentskeptic/kernel/support_core.py` (`get_pointer`) |
| `src/canonicalParams.ts` | `agentskeptic/kernel/support_core.py` |
| `src/valueVerification.ts` | `agentskeptic/kernel/value_verification.py` |
| `src/resolveExpectation.ts` (sql_row subset) | `agentskeptic/kernel/resolve_expectation.py` |
| `src/reconciler.ts` (sql_row + sqlite fetch) | `agentskeptic/kernel/reconciler_sqlite.py` |
| `src/planLogicalSteps.ts` | `agentskeptic/kernel/plan_logical.py` |
| `src/eventSequenceIntegrity.ts` | `agentskeptic/kernel/event_sequence.py` |
| `src/aggregate.ts` | `agentskeptic/kernel/aggregate.py` |
| `src/verificationRunContext.ts` | `agentskeptic/kernel/verification_run_context.py` |
| `src/executionPathFindings.ts` | `agentskeptic/kernel/execution_path_findings.py` |
| `src/verificationDiagnostics.ts` (subset) | `agentskeptic/kernel/verification_diagnostics.py` |
| `src/reconciliationPresentation.ts` (subset) | `agentskeptic/kernel/reconciliation_presentation.py` |
| `src/userPhrases.ts` (subset) | `agentskeptic/kernel/user_phrases.py` |
| `src/workflowTruthReport.ts` (subset) | `agentskeptic/kernel/workflow_truth_report.py` |
| `src/noStepsMessage.ts` | `agentskeptic/kernel/no_steps.py` |
| `src/outcomeCertificate.ts` (subset) | `agentskeptic/kernel/outcome_certificate.py` |
| `src/pipeline.ts` + `verifyRunStateFromBufferedRunEvents` | `agentskeptic/kernel/verify_sqlite.py` |
| `src/langGraphCheckpointTrustGate.ts` (eligibility) | `agentskeptic/kernel/verify_sqlite.py` |

Postgres async path and non-`sql_row` verification kinds are **not** ported in v1.
