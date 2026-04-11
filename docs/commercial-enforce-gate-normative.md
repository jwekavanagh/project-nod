# Commercial enforce gate (normative)

Single source of truth for **who may run `agentskeptic enforce`** and how it relates to the **license reserve API**.

## OSS build (`WF_BUILD_PROFILE=oss`, default `npm run build`)

- **`agentskeptic enforce`** is **not supported**. Any invocation **except** help (`--help` or `-h` anywhere in the args after `enforce`) **exits 3** with operational code **`ENFORCE_REQUIRES_COMMERCIAL_BUILD`** and the message constant **`ENFORCE_OSS_GATE_MESSAGE`** in `src/enforceCli.ts` (emitted via `cliErrorEnvelope`).
- **Batch or `quick` with `--output-lock` or `--expect-lock`** is **not supported** on the OSS build: **exits 3** with **`ENFORCE_REQUIRES_COMMERCIAL_BUILD`** (see `src/cli.ts`).
- **`ENFORCE_USAGE`** is **never** emitted on the OSS build for `enforce`; the commercial-build gate is the only non-help failure mode for bare `enforce` invocations.

## Help

- If `--help` or `-h` appears in the `enforce` tail args, the CLI prints usage and **exits 0** (OSS and commercial).

## Commercial build (`npm run build:commercial`)

After the OSS gate (skipped when `LICENSE_PREFLIGHT_ENABLED` is true), **`runEnforce`** behaves as follows:

1. `mode = args[0]`.
2. If `mode` is neither `batch` nor `quick` → **`ENFORCE_USAGE`**, exit 3 — **no** license preflight.
3. If `mode === "batch"` → **`runEnforceBatch`**, which **first** calls **`runLicensePreflightIfNeeded("enforce")`**, then **`runBatchCiLockFromRestArgs`** in `src/ciLockWorkflow.ts` (shared with batch verify + lock flags).
4. If `mode === "quick"` → **`runEnforceQuick`**, which **first** calls **`runLicensePreflightIfNeeded("enforce")`**, then **`runQuickCiLockFromRestArgs`** in `src/ciLockWorkflow.ts` (shared with `quick` + lock flags).

## License reserve (production)

- The commercial CLI contacts **`POST /api/v1/usage/reserve`** with `intent=enforce` before running enforcement work. A real deployment must implement the contract exercised by **`website/__tests__/reserve-route.entitlement.integration.test.ts`** and run under **`npm run validate-commercial`** (see validation index below).

## MIT / forks

- Forks may remove or alter the OSS gate. This document describes **upstream** default artifacts and documented install paths.

## Machine-checked validation index

Paths below are verified by **`test/docs-commercial-enforce-gate-normative.test.mjs`**. Each must exist as a non-empty file in the repository.

<!-- commercial-enforce-gate-validation-index:start -->

- `website/__tests__/reserve-route.entitlement.integration.test.ts`
- `scripts/validate-commercial-funnel.mjs`
- `scripts/commercial-enforce-test-harness.mjs`
- `test/enforce-oss-forbidden.test.mjs`
- `test/assurance-cli.test.mjs`

<!-- commercial-enforce-gate-validation-index:end -->
