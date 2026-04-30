# Verification execution identity (integrator SSOT)

This document describes how **merge gate truth** (`npm run verification:truth`), **CLI verification receipts**, **execution identity pinning**, **Python conductor extras**, **Docker replay**, and **live contract URL parity** fit together.

## Finalization ownership

| Surface | Owner | Notes |
|--------|--------|--------|
| Batch / quick `verify` | `src/cliExecutionFinalize.ts` | Every verdict or operational exit writes at most one receipt under `artifacts/agentskeptic-receipts/` (fail-closed: schema or IO error → stderr envelope + exit 3, **no** paradox receipt). |
| `enforce` | `src/cliExecutionFinalize.ts` via `src/enforceStateful.ts` | Drift exits **4** set `verificationSummary.enforceExitKind` to `"drift"`. |
| Merge gate | `src/mergeGateReceiptFinalize.ts` | Imported after `npm run build` from `verification-truth.mjs`; `phaseTimingsMs` covers six buckets only. |

Stray **`process.exit`** in fingerprinted verification paths is forbidden by repo policy scripts (merge gate).

## Receipt directory and filenames

- Directory: `artifacts/agentskeptic-receipts/` (typically gitignored under `artifacts/`).
- Filename: `agentskeptic.verification-receipt.v1.<ISO8601_Z colons→dashes>_<pid>.json`.
- Receipt JSON includes `receiptPathRelative` for auditors.
- **`RECEIPT_WRITE_FAILED` is not a receipt field**; disk failures use stderr plus exit 3 only.

## Merge static vs live contract parity

- **Merge gate / PR CI:** Network-free. `scripts/contract-manifest.mjs --check` ensures committed `schemas/contract/v1.json` matches `website/public/contract/v1.json`, package pin, and seals.
- **Live URL parity:** `scripts/assert-public-contract-url.mjs` fetches `package.json` → `verificationContractManifest.url`, LF-normalizes, SHA-256 compares to committed `schemas/contract/v1.json`. Runs on **scheduled assurance** and **release** workflows — **not** as a PR merge prerequisite.

## Docker replay (Req 6)

- Compose: `compose.verification-replay.yml` + `Dockerfile.verification-replay`.
- Local: `npm run replay:verification` → `docker compose ... run --rm verifier`.
- CI: blocking PR job **`replay_verification_truth`** proves the compose definition stays healthy without depending on the primary verification job cache.

## Python conductor

- `scripts/run-python-test-suite.mjs` is the single CI entry (`npm run test:python`).
- Pip extras **`dev,postgres`** match `dist/execution-identity.v1.json` → `pythonPipExtrasFragment`.

## Execution identity CLI

- `agentskeptic execution-identity verify --expect-json <path>` compares pinned JSON to `dist/execution-identity.v1.json` (ignores `$schema` in compare). Exits **0 / 2 / 3**.

## Integrator ordering (GA)

1. Build / install pinned `agentskeptic` package.
2. Run `agentskeptic execution-identity verify --expect-json <your pin>` before batch verify/enforce if you vendor a pin file.
3. Run `agentskeptic verify` or `enforce` as documented; collect `artifacts/agentskeptic-receipts/` for forensic evidence.
