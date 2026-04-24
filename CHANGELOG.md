# Changelog

## Unreleased

### Breaking

- **CLI assurance stdout:** `agentskeptic assurance run` and `assurance stale` now emit a single JSON line per success path: **`AssuranceOutputV1`** (`schemas/assurance-output-v1.schema.json`). For `run`, the inner report is under **`runReport`** (still **`assurance-run-report-v1`**). **`--write-report`** writes the same envelope bytes as stdout. **`assurance stale` no longer prints a human line to stderr** on exit 0/1; use **`operatorLine`** and structured fields in the envelope. **`issuedAt`** more than five minutes in the future vs the runner clock is exit **3** with **`ASSURANCE_REPORT_ISSUED_AT_FUTURE_SKEW`**. Scenario spawns honor **`AGENTSKEPTIC_ASSURANCE_SCENARIO_TIMEOUT_MS`** (default **900000** ms); timeouts record scenario **`exitCode` 124**.
