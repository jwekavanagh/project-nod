# Adoption validation specification

This document defines how the repository proves the **adoption golden path**: demo wrapper constraints, batch CLI parity, enriched `NO_STEPS_FOR_WORKFLOW` diagnostics, documentation boundaries, and the pinned `npm test` chain.

## Validation proofs

| Id | Proof |
|----|--------|
| WRAPPER_IO | `demo_script_has_no_success_path_console_io` — asserts demo script has zero forbidden success-path I/O substrings and exactly one `console.error(` |
| BATCH_COMPLETE | `cli_wf_complete_batch_contract` |
| BATCH_MISSING | `cli_wf_missing_batch_contract` |
| NO_STEPS_STDOUT | `no_steps_message_matches_template_for_wrong_workflow_id_fixture` |
| NO_STEPS_STDERR | `no_steps_human_stderr_contains_full_message` |
| README_SCOPE | `readme-wedge-inevitability.test.mjs` (adoption order + no `npm start` above `## Advanced`) |
| DOC_BOUNDARY | `adoption-docs-boundary.test.mjs` |
| GOLDEN_PATH_EXECUTABLE | `docs-golden-path-pointer-only.test.mjs` |
| ARTIFACT_REGISTRY | `adoption_validation_spec_registry_matches_plan` |
| ADOPTION_COMPLETE_PATTERN | `node scripts/validate-adoption-complete.mjs` — PatternComplete bootstrap + verify on temp paths; writes `artifacts/adoption-complete-validation-verdict.json` |
| VERDICT | `npm test` runs `npm run build`, Vitest, pinned SQLite `node:test`, `node scripts/first-run.mjs`, `node scripts/validate-adoption-complete.mjs`, `npm run partner-quickstart`, `node scripts/validate-integrate-spine.mjs`, `node dist/cli.js assurance run --manifest examples/assurance/manifest.json`, `node scripts/commercial-enforce-test-harness.mjs`, then `npm run build` again (restore OSS `dist/` after the commercial harness), then `npm run validate-ttfv` — **no** Postgres |
| INTEGRATE_SPINE | `node scripts/validate-integrate-spine.mjs` — full L0 bash E2E, classifier `non_bundled`, missing-env negative, DB-mismatch negative (bootstrap non-zero when contract row absent); writes `artifacts/integrate-spine-validation-verdict.json` |
| ADOPTION_EPISTEMICS_CONTRACT | `adoption-epistemics-contract.test.mjs` — asserts `artifacts/commercial-validation-verdict.json` `layers` shape (`playwrightCommercialE2e`, no `funnel`) and anchor SSOT links |
| REGISTRY_NO_STEPS | `src/registryValidation.test.ts` |

## ADOPTION_ARTIFACT_PROOF (registry TSV)

Canonical registry: exactly **63** data rows (`relpath<TAB>op`), UTF-16 lexicographic order on `relpath`, no header row.

```adoption-registry
artifacts/adoption-complete-validation-verdict.json	add
artifacts/adoption-validation-verdict.json	add
artifacts/commercial-validation-verdict.json	modify
artifacts/integrate-spine-validation-verdict.json	add
config/epistemic-contract-structure.json	add
docs/adoption-epistemics.md	add
docs/adoption-validation-spec.md	modify
docs/agentskeptic.md	modify
docs/commercial.md	modify
docs/epistemic-contract.md	add
docs/first-run-integration.md	modify
docs/first-run-validation-log.md	modify
docs/funnel-observability.md	modify
docs/golden-path.md	modify
docs/decision-gate.md	add
docs/growth-metrics.md	modify
docs/verification-product.md	modify
examples/integrate-your-db/bootstrap-input.json	add
examples/integrate-your-db/required-sqlite-state.sql	add
examples/decision-gate-canonical.mjs	add
package.json	modify
README.md	modify
scripts/demo.mjs	add
scripts/first-run.mjs	delete
scripts/lib/readEpistemicContractFence.mjs	add
scripts/record-adoption-verdict.mjs	add
scripts/regen-truth-goldens.mjs	modify
scripts/sync-adoption-canonical-to-llms.mjs	add
scripts/sync-epistemic-contract-website.mjs	add
scripts/templates/integrate-activation-shell.bash	modify
scripts/validate-adoption-complete.mjs	add
scripts/validate-commercial-funnel.mjs	modify
scripts/validate-epistemic-contract-structure.mjs	add
scripts/validate-integrate-spine.mjs	add
scripts/verify-adoption-verdict.mjs	add
src/loadEvents.ts	modify
src/noStepsMessage.ts	add
src/pipeline.ts	modify
src/registryValidation.test.ts	modify
src/registryValidation.ts	modify
src/types.ts	modify
src/verifyAgentskeptic.test.ts	add
src/verifyAgentskeptic.ts	add
src/workflowTruthReport.semantics.test.ts	modify
src/wrongWorkflowIdAdoptionFixture.test.ts	add
test/adoption-complete-surface-parity.test.mjs	add
test/adoption-docs-boundary.test.mjs	add
test/adoption-epistemics-contract.test.mjs	add
test/adoption-validation-registry.test.mjs	add
test/adoption-validation.test.mjs	add
test/cli.test.mjs	modify
test/docs-golden-path-pointer-only.test.mjs	add
test/fixtures/adoption-validation/wrong-workflow-id.events.ndjson	add
test/integrate-spine-contract.test.mjs	add
test/npm-scripts-contract.test.mjs	modify
test/pipeline.sqlite.test.mjs	modify
test/sync-adoption-canonical-to-llms.test.mjs	add
test/validate-adoption-complete-failure.test.mjs	add
test/verify-agentskeptic-consumer.e2e.test.mjs	add
website/__tests__/epistemicContractIntegrator.parity.test.ts	add
website/src/content/productCopy.ts	modify
website/src/generated/epistemicContractIntegrator.ts	add
website/src/generated/integrateActivationShellStatic.ts	modify
website/src/generated/integratorDocsEmbedded.ts	modify
```

After a successful `npm test`, that chain (see VERDICT row) has exercised the onboarding smoke (`scripts/first-run.mjs`), **PatternComplete** proof (`scripts/validate-adoption-complete.mjs`), **IntegrateSpine** proof (`scripts/validate-integrate-spine.mjs`), `assurance run` against `examples/assurance/manifest.json`, the commercial enforce harness (rebuilds commercial `dist/`; minimal CI enforcement, `enforce` tests, and `assurance` CLI regression tests), a final **`npm run build`** to restore the default OSS `dist/` (commercial **`quick`**/`verify` requires a license server, so TTFV must run on OSS), then TTFV validation. Optional legacy scripts `scripts/record-adoption-verdict.mjs` and `scripts/verify-adoption-verdict.mjs` can still record `artifacts/adoption-validation-verdict.json` manually; they are **not** invoked by the default `npm test` script.
