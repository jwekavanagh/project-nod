/**
 * Single registry: every test/*.test.mjs is in exactly one of
 * - sqliteNodeTestFiles (default node:test batch, plus guards in verify)
 * - postgresNodeTestFiles (CI postgres batch; OSS dist)
 * - commercialHarnessNodeTestFiles (commercial dist + license mock; commercial-enforce-test-harness.mjs, no --require-postgres)
 * - commercialPostgresHarnessNodeTestFiles (enforce + postgres; only commercial-enforce-test-harness.mjs --require-postgres)
 * - nodeTestScheduledByVerify (run only in scripts/verify.mjs, not the sqlite batch; ordering contract)
 * @packageDocumentation
 */
export const sqliteNodeTestFiles = [
  "test/reconciler.sqlite.test.mjs",
  "test/pipeline.sqlite.test.mjs",
  "test/pipeline-state-stores-sqlite.test.mjs",
  "test/decisionGate.test.mjs",
  "test/workflowTruthReport.test.mjs",
  "test/cli.test.mjs",
  "test/cli-version.test.mjs",
  "test/post-product-activation-install-id.test.mjs",
  "test/workflow-lineage-classify.test.mjs",
  "test/resolve-telemetry-source.test.mjs",
  "test/github-workflows-agentskeptic-telemetry-env.test.mjs",
  "test/github-workflows-release-contract.test.mjs",
  "test/version-integrity.test.mjs",
  "test/verify-release-distribution.test.mjs",
  "test/release-preview-paths.test.mjs",
  "test/release-preview.test.mjs",
  "test/release-outcome-summarize.test.mjs",
  "test/maybe-emit-oss-claim-telemetry-off.test.mjs",
  "test/first-run-verify-output.integration.test.mjs",
  "test/stable-failure-consistency.test.mjs",
  "test/workflow-result-consumer-contract.test.mjs",
  "test/workflow-result-stdout-version.test.mjs",
  "test/docs-relational.test.mjs",
  "test/tools-registry-relational-surface.test.mjs",
  "test/tools-registry-state-stores.contract.test.mjs",
  "test/docs-contract.test.mjs",
  "test/docs-commercial-enforce-gate-normative.test.mjs",
  "test/docs-remediation-doctrine.test.mjs",
  "test/bundle-signature-fixture.test.mjs",
  "test/bundle-signature-codes-doc.test.mjs",
  "test/bundle-signature-cli-write.test.mjs",
  "test/quick-verify.sqlite.test.mjs",
  "test/bootstrap-pack.test.mjs",
  "test/crossing-cli.test.mjs",
  "test/quickVerifyPostbuildGate.test.mjs",
  "test/npm-scripts-contract.test.mjs",
  "test/langgraph-reference-emitter-before-cli-spawn.test.mjs",
  "test/langgraph-checkpoint-trust-terminal.contract.test.mjs",
  "test/langgraph-ineligible-certificate.import-guard.test.mjs",
  "test/removed-script-names-ban.test.mjs",
  "test/docs-workflow-result-normative-prose.test.mjs",
  "test/enforce-oss-forbidden.test.mjs",
  "test/oss-output-lock-batch.test.mjs",
  "test/lock-success-monetized-footer.integration.test.mjs",
  "test/lock-flags-removed.guard.test.mjs",
  "test/docs-enforce-stream-contract.test.mjs",
  "test/docs-quick-enforce-link.test.mjs",
  "test/discovery-payload.test.mjs",
  "test/redaction-rules.test.mjs",
  "test/indexable-guide-paths-fs.contract.test.mjs",
  "test/npm-pack-discovery-scripts.test.mjs",
  "test/registry-metadata-parity.test.mjs",
  "test/docs-related-exists-export-negative.mjs",
  "test/quick-param-pointer.gates.test.mjs",
  "test/dependency-security-pins.schema.contract.test.mjs",
  "test/drizzle-identifier-safety.contract.test.mjs",
  "test/assert-destructive-postgres-urls.test.mjs",
  "test/readme-wedge-inevitability.test.mjs",
  "test/adoption-complete-surface-parity.test.mjs",
  "test/adoption-epistemics-contract.test.mjs",
  "test/integrate-spine-contract.test.mjs",
  "test/integrate-spine-fixtures.test.mjs",
  "test/integrate-route-copy-absence.test.mjs",
  "test/adoption-validation-registry.test.mjs",
  "test/decision-ready-surfaces-manifest.test.mjs",
  "test/contract-manifest.hash.test.mjs",
  "test/contract-manifest.pkg-parity.test.mjs",
  "test/contract-manifest.adversarial-member.test.mjs",
  "test/contract-manifest.adversarial-manifest-edit.test.mjs",
  "test/contract-manifest.history-monotonic.test.mjs",
  "test/contract-manifest.bump-required.test.mjs",
  "test/openapi-contract-pointer.test.mjs",
  "test/contract-pointers.discovery.test.mjs",
  "test/no-stale-contract-prose.test.mjs",
  "test/oss-legacy-handoff-ban.test.mjs",
  "test/sync-adoption-canonical-to-llms.test.mjs",
  "test/verify-agentskeptic-consumer.e2e.test.mjs",
  "test/docs-first-five-minutes-ssot.guard.mjs",
  // Previously unlisted: now classified so the registry is exhaustive
  "test/adoption-docs-boundary.test.mjs",
  "test/adoption-validation.test.mjs",
  "test/assurance-cli.test.mjs",
  "test/docs-golden-path-pointer-only.test.mjs",
  "test/golden-path-drift.contract.test.mjs",
  "test/integrate-spine-step3-chain.happy.test.mjs",
  "test/integrate-spine-step3-chain.negative.test.mjs",
  "test/no-handrolled-node-test-lists.mjs",
  "test/registry-draft-contract.test.mjs",
  "test/registry-draft-no-dual-contract.test.mjs",
  "test/draft-corpus-gate.test.mjs",
  "test/registry-draft-fault-matrix.test.mjs",
  "test/registry-draft-outcome-chain-import-guard.test.mjs",
  "test/registry-draft-outcome-chain.test.mjs",
  "test/suite-coverage.mjs",
  "test/sync-buyer-authority-fences.test.mjs",
  "test/validate-commercial-funnel-registry-draft-harness.test.mjs",
  "test/visitor-problem-outcome.test.mjs",
  "test/website-gate-modules.contract.test.mjs",
];

export const postgresNodeTestFiles = [
  "test/postgres-session-readonly.test.mjs",
  "test/postgres-privilege.test.mjs",
  "test/pipeline.postgres.test.mjs",
  "test/decisionGate.postgres.test.mjs",
  "test/ci-workflow-truth-postgres-contract.test.mjs",
  "test/quick-verify.postgres.test.mjs",
];

export const commercialHarnessNodeTestFiles = [
  "test/assurance-cli-enforce.test.mjs",
  "test/commercial-license-reserve-intent.test.mjs",
  "test/crossing-commercial-smoke.test.mjs",
  "test/enforce-cli.test.mjs",
];

export const commercialPostgresHarnessNodeTestFiles = [
  "test/ci-workflow-truth-postgres-enforce.test.mjs",
];

/** Not run in the sqlite node --test batch: ordering with validate-adoption stages in verify.mjs. */
export const nodeTestScheduledByVerify = ["test/validate-adoption-complete-failure.test.mjs"];

/** Top-level `test/*.mjs` run only via `scripts/verify.mjs` (not `node --test` batch), besides suites.mjs. */
export const mjsAtTestRootRunByVerifyOnly = ["test/partner-quickstart.adversarial.mjs"];
