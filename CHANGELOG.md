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
