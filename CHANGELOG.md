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
