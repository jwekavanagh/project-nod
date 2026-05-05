## [7.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.5.0...v7.0.0) (2026-05-05)

### ⚠ BREAKING CHANGES

* **core,web:** multi-store legibility and step_registry_expectation v7 (#61)

### Features

* **core,web:** multi-store legibility and step_registry_expectation v7 ([#61](https://github.com/jwekavanagh/agentskeptic/issues/61)) ([56e0894](https://github.com/jwekavanagh/agentskeptic/commit/56e08941ecba6e702dcefcbdd107a5978cd2a542))

## [7.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.5.0...v7.0.0) (2026-05-04)

### ⚠ BREAKING CHANGES

* **correctness:** `correctnessDefinition.enforcementKind` and matching `enforceable_projection.projectionKind` no longer accept **`step_sql_expectation`**. The canonical value is **`step_registry_expectation`** (same semantics: registry-backed expected downstream state for a step). Strict JSON Schema validation rejects archived payloads until migrated.

### Features

* **docs / examples:** store-neutral verification copy; Quick vs contract positioning; deterministic hybrid proof via **`examples/hybrid-contract-demo.mjs`** and **`test/pipeline.postgres.test.mjs`** (`wf_hybrid_demo`, local HTTP witness + SQL).

### Migration (archived JSON)

Re-emit or transform stored artifacts that still contain the legacy string. Non-interactive full-document example:

```bash
jq 'walk(if type == "string" and . == "step_sql_expectation" then "step_registry_expectation" else . end)' in.json > out.json
```

Scope the `walk` to your own retention paths; the pattern above updates every string occurrence in the file.

## [6.5.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.4.0...v6.5.0) (2026-05-04)

### Features

* **web:** sharpen how-it-works acquisition copy and CTAs ([#58](https://github.com/jwekavanagh/agentskeptic/issues/58)) ([dc2e32f](https://github.com/jwekavanagh/agentskeptic/commit/dc2e32f60991881c0911d3a596acefbacd500213))

## [6.4.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.3.1...v6.4.0) (2026-05-04)

### Features

* **web:** proof-first integrate surfaces and activation journey copy gate ([#57](https://github.com/jwekavanagh/agentskeptic/issues/57)) ([129abaf](https://github.com/jwekavanagh/agentskeptic/commit/129abafef7b9b7429a6b8819d9b06a157d3e34eb))

## [Unreleased]

### Features

* **web:** proof-first `/integrate` and `/integrate/guided` activation (quick before contract check, optional Formalize CTA, graduation to `check` / `enforce`); marketing `integratePage.quickVerifyCommand` SSOT and `validate-activation-journey-copy` merge gate

## [6.3.1](https://github.com/jwekavanagh/agentskeptic/compare/v6.3.0...v6.3.1) (2026-05-04)

### Bug Fixes

* **verify:** add verification:truth:local via website/.env ([#56](https://github.com/jwekavanagh/agentskeptic/issues/56)) ([387c61e](https://github.com/jwekavanagh/agentskeptic/commit/387c61e2654262dcf16fcf40fc0c931d26b094e1))

## [6.3.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.2.0...v6.3.0) (2026-05-04)

### Features

* **telemetry:** opt-in product activation telemetry on OSS CLI ([#55](https://github.com/jwekavanagh/agentskeptic/issues/55)) ([df750cb](https://github.com/jwekavanagh/agentskeptic/commit/df750cb85990103e589def487674f53528745709))

## [6.2.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.1.0...v6.2.0) (2026-05-03)

### Features

* add guided remediation rerun loop ([#54](https://github.com/jwekavanagh/agentskeptic/issues/54)) ([5064037](https://github.com/jwekavanagh/agentskeptic/commit/5064037521f0aab39d0d874aab82744509e850e8))

## [6.1.0](https://github.com/jwekavanagh/agentskeptic/compare/v6.0.1...v6.1.0) (2026-05-03)

### Features

* remediation decision SSOT and certificate remediation UX ([#53](https://github.com/jwekavanagh/agentskeptic/issues/53)) ([c51a902](https://github.com/jwekavanagh/agentskeptic/commit/c51a902ef17f72a8a626420e8e684c8534905414))

## [6.0.1](https://github.com/jwekavanagh/agentskeptic/compare/v6.0.0...v6.0.1) (2026-05-03)

### Bug Fixes

* **emit:** add Cursor Cloud specific instructions to AGENTS.md ([#51](https://github.com/jwekavanagh/agentskeptic/issues/51)) ([2d6d316](https://github.com/jwekavanagh/agentskeptic/commit/2d6d316a9f36fd1c5b81819f5f18999ba2b847cc))

## [6.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v5.0.0...v6.0.0) (2026-05-03)

### ⚠ BREAKING CHANGES

* unified failure spine (Outcome Certificate v3) (#50)

### Features

* unified failure spine (Outcome Certificate v3) ([#50](https://github.com/jwekavanagh/agentskeptic/issues/50)) ([25fc34b](https://github.com/jwekavanagh/agentskeptic/commit/25fc34bec70c176c9d5d9a73de1f651d71f10a4a))

## [5.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v4.2.0...v5.0.0) (2026-05-03)

### ⚠ BREAKING CHANGES

* **cli:** outcome certificate v2 evidence completeness (#49)

### Features

* **cli:** outcome certificate v2 evidence completeness ([#49](https://github.com/jwekavanagh/agentskeptic/issues/49)) ([be3fd20](https://github.com/jwekavanagh/agentskeptic/commit/be3fd20b353e8fdaee9abbc9994a63a5141c2dc4))

## [5.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v4.2.0...v5.0.0) (2026-05-02)

### ⚠ BREAKING CHANGES

* **certificate:** Outcome Certificate **`schemaVersion` 2** with required **`evidenceCompleteness`**; human stderr uses anchored **`=== evidence_completeness ===`** block via a single formatter (legacy **`formatDecisionBlockerForHumans`** export removed).
* **share:** **`POST /api/public/verification-reports`** accepts **envelope `schemaVersion` 3** only (inner Outcome Certificate v2).
* **governance:** enforcement ingestion payloads use **`schema_version` 3** and **`outcome_certificate`** (**`schema_version` 2** / **`outcome_certificate_v1`** rejected).
* **beacon:** licensed **`POST /api/v1/funnel/verify-outcome`** requires **`schema_version` 3** and **`evidence_gap_primary`** (mirror of **`evidenceCompleteness.blockerCategory`**).
* **material truth:** governance projection bumps to **material-truth v2** (includes **`evidenceGapPrimary`**); customers pinning **`material_truth_sha256`** must re-baseline once.

### Features

* **quick:** **`QuickVerifyReport` `schemaVersion` 5** carries the same **`evidenceCompleteness`** shape as certificates for drift-free rollup signals.

### Bug Fixes

* **docs/ci:** tighten normative anchors, integrate quick-first ladder, and OpenAPI / Python parity for commercial request schemas.

## [4.2.0](https://github.com/jwekavanagh/agentskeptic/compare/v4.1.1...v4.2.0) (2026-05-02)

### Features

* **cli:** primary truth check path ([#47](https://github.com/jwekavanagh/agentskeptic/issues/47)) ([b582920](https://github.com/jwekavanagh/agentskeptic/commit/b582920f1ee0a526603eb2fb696667b2a4b54021))

### Bug Fixes

* **ci:** stabilize npm footprint consumer install ([#48](https://github.com/jwekavanagh/agentskeptic/issues/48)) ([9a7c113](https://github.com/jwekavanagh/agentskeptic/commit/9a7c113a95b668b9b553b0d923e2220f96685aea))

## [4.1.1](https://github.com/jwekavanagh/agentskeptic/compare/v4.1.0...v4.1.1) (2026-05-01)

### Features

* **cli / sdk:** primary truth check is **`agentskeptic check`** and **`AgentSkeptic.check()`**; bare positional batch verify remains supported for compatibility.

### Bug Fixes

* **release-package:** declare pypi GitHub environment for Trusted Publishing OIDC ([#46](https://github.com/jwekavanagh/agentskeptic/issues/46)) ([5bff57d](https://github.com/jwekavanagh/agentskeptic/commit/5bff57d7a453b3068a6bf55f4f32c564e308925d))

## [4.1.0](https://github.com/jwekavanagh/agentskeptic/compare/v4.0.1...v4.1.0) (2026-05-01)

### Features

* **verify:** ship S3 and Mongo witnesses and truthful copy ([e761488](https://github.com/jwekavanagh/agentskeptic/commit/e76148801a47ce8a7984d5698c34c5d079884310))

## [4.0.1](https://github.com/jwekavanagh/agentskeptic/compare/v4.0.0...v4.0.1) (2026-05-01)

### Bug Fixes

* **ci:** light path for release churn and tag-scoped PyPI ([81b7ad4](https://github.com/jwekavanagh/agentskeptic/commit/81b7ad4eca950dd2eab1c5ea5e3ad7ad1f401128))

## [4.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.7.0...v4.0.0) (2026-05-01)

### ⚠ BREAKING CHANGES

* trust-lean OSS v4 kernel and website-owned registry draft

### Features

* trust-lean OSS v4 kernel and website-owned registry draft ([6001bb8](https://github.com/jwekavanagh/agentskeptic/commit/6001bb80ff577e6fe0fe88d0f9520013cddc1e7d))

### Bug Fixes

* **release:** conventionalcommits preset for analyzer and notes ([#43](https://github.com/jwekavanagh/agentskeptic/issues/43)) ([d3ad6e1](https://github.com/jwekavanagh/agentskeptic/commit/d3ad6e1948a458a34d1406b2c0529191586b441a))

# [4.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.7.0...v4.0.0) (2026-04-30)

### ⚠ BREAKING CHANGES

* **api:** Remove deprecated root exports (`createDecisionGate`, `verifyWorkflow`, `verifyAgentskeptic`, `runQuickVerify`, `runQuickVerifyToValidatedReport`, `Gate`) and deprecation shims — use **`AgentSkeptic`** from **`agentskeptic`** (`gate`, `verify`, `replayFromFile`, `quick`).
* **cli:** Drop **`agentskeptic registry-draft`**; registry drafting is **`POST /api/integrator/registry-draft`** (**website** **`website/src/lib/registry-draft/`**) plus guided flows.
* **deps:** Remove BigQuery / MSSQL / Mongo / S3 client libraries from OSS; connectors return **`VERIFICATION_CONNECTOR_NOT_SHIPPED`**.
* **telemetry:** OSS account-link **`fetch`** + stderr **`handoff_url`** require **`AGENTSKEPTIC_OSS_CLAIM=1`**; remove automatic browser continuation POSTs from the OSS CLI path.
* **artifacts:** Adoption and commercial validators write **`artifacts/generated/*-validation-verdict.json`** (untracked); delete committed legacy verdict JSON at repo **`artifacts/`** root.

### Features

* **ci:** npm footprint regression compares merge-branch **`npm pack`** size (within **≤3%** of frozen **v3.7.0** tarball bytes) and production **`npm install`** file count (**strict improvement** vs v3.7.0).

# [3.7.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.6.0...v3.7.0) (2026-05-01)


### Features

* **cli:** canonical activation journey and spine validator harness ([ca26480](https://github.com/jwekavanagh/agentskeptic/commit/ca26480ee2ae56a3865e82c84db5d73c9988bb99))

# [3.6.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.5.0...v3.6.0) (2026-04-30)


### Bug Fixes

* **replay:** stabilize quickVerify threshold import in replay gate ([#40](https://github.com/jwekavanagh/agentskeptic/issues/40)) ([cf6b3b0](https://github.com/jwekavanagh/agentskeptic/commit/cf6b3b00294997ab5d33ce8e8ca738e6ecba5e74))


### Features

* **verification:** hosted enforcement lifecycle FSM ([#39](https://github.com/jwekavanagh/agentskeptic/issues/39)) ([8e97097](https://github.com/jwekavanagh/agentskeptic/commit/8e9709716aed820422e017e553a42ff5fca0f835))

# [3.5.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.4.0...v3.5.0) (2026-04-30)


### Features

* **verification:** execution identity, receipts, Docker replay, contract URL parity ([#38](https://github.com/jwekavanagh/agentskeptic/issues/38)) ([b65e898](https://github.com/jwekavanagh/agentskeptic/commit/b65e898d3a8401fb9da83861b86eaf061df7c3fe))

# [3.4.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.3.3...v3.4.0) (2026-04-30)


### Features

* **cli:** decision evidence bundle and governance export v2 ([#37](https://github.com/jwekavanagh/agentskeptic/issues/37)) ([a68cfb0](https://github.com/jwekavanagh/agentskeptic/commit/a68cfb0de8d9af01fd2b4db234efcc2b3c6cc38c))

## [3.3.3](https://github.com/jwekavanagh/agentskeptic/compare/v3.3.2...v3.3.3) (2026-04-30)


### Bug Fixes

* **website:** account page tolerates missing api_key_v2 table ([#36](https://github.com/jwekavanagh/agentskeptic/issues/36)) ([42340ee](https://github.com/jwekavanagh/agentskeptic/commit/42340ee7d560ab505e3018c96998e436c9af1818))

## [3.3.2](https://github.com/jwekavanagh/agentskeptic/compare/v3.3.1...v3.3.2) (2026-04-29)


### Bug Fixes

* **website:** bundle config JSON for serverless ([#35](https://github.com/jwekavanagh/agentskeptic/issues/35)) ([4c5d05c](https://github.com/jwekavanagh/agentskeptic/commit/4c5d05cbff979419fc104a609d75491986f1f99f))

## [3.3.1](https://github.com/jwekavanagh/agentskeptic/compare/v3.3.0...v3.3.1) (2026-04-29)


### Bug Fixes

* **website:** ship commercial plans with /account serverless bundle ([#34](https://github.com/jwekavanagh/agentskeptic/issues/34)) ([5311ded](https://github.com/jwekavanagh/agentskeptic/commit/5311ded68f327f9cdb9eb81af1d5783753b04309))

# [3.3.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.2.0...v3.3.0) (2026-04-29)


### Features

* **website:** ship paste-first verify experience ([#33](https://github.com/jwekavanagh/agentskeptic/issues/33)) ([0e1832f](https://github.com/jwekavanagh/agentskeptic/commit/0e1832fe2c8e46c28cf8c4241f21747d2a2cc795))

# [3.2.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.1.0...v3.2.0) (2026-04-29)


### Features

* **website:** buyer truth SSOT contract and CI gate ([#32](https://github.com/jwekavanagh/agentskeptic/issues/32)) ([d62ded1](https://github.com/jwekavanagh/agentskeptic/commit/d62ded10959d987f34e537d76126c158ff6f2fca))

# [3.1.0](https://github.com/jwekavanagh/agentskeptic/compare/v3.0.0...v3.1.0) (2026-04-29)


### Features

* **governance:** make enforcement evidence-native and drift deterministic ([#31](https://github.com/jwekavanagh/agentskeptic/issues/31)) ([f68c0ad](https://github.com/jwekavanagh/agentskeptic/commit/f68c0adb99732537c75ff48922cdf234af285129))

# [3.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v2.4.0...v3.0.0) (2026-04-29)


* feat(trust)!: trust decision authority layer ([e736224](https://github.com/jwekavanagh/agentskeptic/commit/e73622461beee7dfa32c4716165ab9ce8eea5061))


### BREAKING CHANGES

* DecisionUnsafeError and LangGraphCheckpointTrustUnsafeError removed.

Use TrustDecisionBlockedError; record matches TrustDecisionRecordV1 shape.

Made-with: Cursor

* fix(trust): satisfy commercial ingest guard without preflight literal in comment

Made-with: Cursor

* fix(python): add Pydantic models for TrustDecisionRecord OpenAPI schemas

Made-with: Cursor

# [2.4.0](https://github.com/jwekavanagh/agentskeptic/compare/v2.3.0...v2.4.0) (2026-04-28)


### Features

* **ci:** unified verification:truth runner and merged verification job ([07ac282](https://github.com/jwekavanagh/agentskeptic/commit/07ac282be1b7c2ba8993ca72f41189566c5fe072))

# [2.3.0](https://github.com/jwekavanagh/agentskeptic/compare/v2.2.0...v2.3.0) (2026-04-28)


### Features

* **loop:** ship canonical local truth loop command ([#28](https://github.com/jwekavanagh/agentskeptic/issues/28)) ([6529dd6](https://github.com/jwekavanagh/agentskeptic/commit/6529dd6d975589c3e0efb32813d5efc5b6c7e0fc))

# [2.2.0](https://github.com/jwekavanagh/agentskeptic/compare/v2.1.0...v2.2.0) (2026-04-28)


### Features

* **emission:** enforce canonical emitter-first integration ([#27](https://github.com/jwekavanagh/agentskeptic/issues/27)) ([ba2a404](https://github.com/jwekavanagh/agentskeptic/commit/ba2a4044c10ff33adde5da07b69d53fe86032b0f))

# [2.1.0](https://github.com/jwekavanagh/agentskeptic/compare/v2.0.0...v2.1.0) (2026-04-28)


### Features

* **golden-path:** ship executable Next.js + Postgres reference ([#26](https://github.com/jwekavanagh/agentskeptic/issues/26)) ([f7aa1f7](https://github.com/jwekavanagh/agentskeptic/commit/f7aa1f783010e2c98f89f5dfe047d176332bcda1))

# [2.0.0](https://github.com/jwekavanagh/agentskeptic/compare/v1.4.0...v2.0.0) (2026-04-28)


* feat(registry-draft)!: unified draft engine and response schema v3 ([7a6f482](https://github.com/jwekavanagh/agentskeptic/commit/7a6f482510314b8abe3793058afe6d1eb65e70d8))


### BREAKING CHANGES

* registry-draft responses use schema v3; the v2 JSON schema file is removed.

## Validation
Local: `npm run test:node:sqlite` (build, node guards, full SQLite node:test suite incl. draft gates).

# [1.4.0](https://github.com/jwekavanagh/agentskeptic/compare/v1.3.0...v1.4.0) (2026-04-28)


### Features

* **contract:** verification contract manifest v1 ([#24](https://github.com/jwekavanagh/agentskeptic/issues/24)) ([a5c4533](https://github.com/jwekavanagh/agentskeptic/commit/a5c45334cba13a03e18ac8e10a924a4295abd883))

# [1.3.0](https://github.com/jwekavanagh/agentskeptic/compare/v1.2.1...v1.3.0) (2026-04-28)


### Bug Fixes

* **release:** publish 1.2.2 after npm blocked duplicate 1.2.0 ([#23](https://github.com/jwekavanagh/agentskeptic/issues/23)) ([eb70266](https://github.com/jwekavanagh/agentskeptic/commit/eb70266ee15f3b4cfb5958fb74fd281f9bba30b3))


### Features

* enhance integration documentation and API response structure ([#22](https://github.com/jwekavanagh/agentskeptic/issues/22)) ([23f2bde](https://github.com/jwekavanagh/agentskeptic/commit/23f2bde4bf39aa61d795347ca67505407a6228bc))

# [1.2.0](https://github.com/jwekavanagh/agentskeptic/compare/v1.1.3...v1.2.0) (2026-04-28)


### Features

* unified version integrity (merge gate, OpenAPI, CLI --version, post-PyPI verify) ([#20](https://github.com/jwekavanagh/agentskeptic/issues/20)) ([61c99a8](https://github.com/jwekavanagh/agentskeptic/commit/61c99a8ff104bdf597bbf3d2143a6c1ba7593af6))

## [1.1.3](https://github.com/jwekavanagh/agentskeptic/compare/v1.1.2...v1.1.3) (2026-04-27)


### Bug Fixes

* **ci:** bump create-github-app-token to v3 in release workflow ([#21](https://github.com/jwekavanagh/agentskeptic/issues/21)) ([548f9e7](https://github.com/jwekavanagh/agentskeptic/commit/548f9e79275d8993a297e4d24bbea66d31010ca5))

## [1.1.2](https://github.com/jwekavanagh/agentskeptic/compare/v1.1.1...v1.1.2) (2026-04-27)


### Bug Fixes

* **ci:** register GitHub deployment after vercel --prod for environments UI ([#18](https://github.com/jwekavanagh/agentskeptic/issues/18)) ([2dc3eb7](https://github.com/jwekavanagh/agentskeptic/commit/2dc3eb75ab03efb3b7445745e5a5a383b6c1914f))

## [1.1.1](https://github.com/jwekavanagh/agentskeptic/compare/v1.1.0...v1.1.1) (2026-04-27)


### Bug Fixes

* **release:** publish 1.1.1 after npm blocked duplicate 1.1.0 ([#17](https://github.com/jwekavanagh/agentskeptic/issues/17)) ([9f5ffbf](https://github.com/jwekavanagh/agentskeptic/commit/9f5ffbf6c1896f0a0fa649fc79ba18e6c2e08bf3))

# [1.1.0](https://github.com/jwekavanagh/agentskeptic/compare/v1.0.1...v1.1.0) (2026-04-27)


### Bug Fixes

* **ci:** lhci per-url performance floors; relax home for ci noise ([#16](https://github.com/jwekavanagh/agentskeptic/issues/16)) ([d69bae1](https://github.com/jwekavanagh/agentskeptic/commit/d69bae1433caf2172f85817e530d0d66e1b68210))


### Features

* **website:** SEO metadata, title template, sitemap, preview noindex ([#14](https://github.com/jwekavanagh/agentskeptic/issues/14)) ([682fd7a](https://github.com/jwekavanagh/agentskeptic/commit/682fd7a366af5e7c05098ab4e8cf224fcddfcb11))

## [1.0.1](https://github.com/jwekavanagh/agentskeptic/compare/v1.0.0...v1.0.1) (2026-04-27)


### Bug Fixes

* harden CI/release reliability and commit message DX ([#13](https://github.com/jwekavanagh/agentskeptic/issues/13)) ([b5c0c16](https://github.com/jwekavanagh/agentskeptic/commit/b5c0c1690f57241f12a8efdddf5eb3c0ca3af20d))

# 1.0.0 (2026-04-27)


### Bug Fixes

* release visibility and pre-merge eligibility ([#11](https://github.com/jwekavanagh/agentskeptic/issues/11)) ([669065c](https://github.com/jwekavanagh/agentskeptic/commit/669065cddd669a511f284e6a78a975639ba45ef6))


### Features

* stateful enforcement, unified CI, and release automation ([#12](https://github.com/jwekavanagh/agentskeptic/issues/12)) ([0275407](https://github.com/jwekavanagh/agentskeptic/commit/027540788b3251ad5106f48555e1a58124e228a9))

# Changelog

## 1.2.1

### Changed

- Bumped **agentskeptic** and **agentskeptic-web** to **1.2.1**: `package.json` (root + workspace), `package-lock.json`, Quick Verify spec version (`QUICK_VERIFY_VERSION`, schema, normative doc, golden fixtures, I1 gate tests), `AGENTSKEPTIC_CLI_SEMVER`, Python `pyproject.toml` / `PKG-INFO`, debug corpus `producer.version`, embedded report `workflowVerifierVersion` locks.

## 1.2.0

### Changed

- Bumped **agentskeptic** and **agentskeptic-web** to **1.2.0** for npm publish: root and workspace `package.json`, `package-lock.json`, `AGENTSKEPTIC_CLI_SEMVER` in `src/publicDistribution.generated.ts`, Python `pyproject.toml` / `PKG-INFO`, demo corpus `producer.version`, and embedded report lock `workflowVerifierVersion` fields.

## Unreleased

### Breaking

- **CLI assurance stdout:** `agentskeptic assurance run` and `assurance stale` now emit a single JSON line per success path: **`AssuranceOutputV1`** (`schemas/assurance-output-v1.schema.json`). For `run`, the inner report is under **`runReport`** (still **`assurance-run-report-v1`**). **`--write-report`** writes the same envelope bytes as stdout. **`assurance stale` no longer prints a human line to stderr** on exit 0/1; use **`operatorLine`** and structured fields in the envelope. **`issuedAt`** more than five minutes in the future vs the runner clock is exit **3** with **`ASSURANCE_REPORT_ISSUED_AT_FUTURE_SKEW`**. Scenario spawns honor **`AGENTSKEPTIC_ASSURANCE_SCENARIO_TIMEOUT_MS`** (default **900000** ms); timeouts record scenario **`exitCode` 124**.
