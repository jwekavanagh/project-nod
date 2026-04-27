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
