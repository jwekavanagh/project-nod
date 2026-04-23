# Crossing — normative CLI and integrator path (SSOT)

This document is the **single normative source** for **`agentskeptic crossing`**: invocation shapes, stdout/stderr ordering, exit codes, degraded behavior, and how crossing relates to bootstrap, **`verify-integrator-owned`**, and integrator telemetry.

**Precedence:** Integrators follow this document first. [`first-run-integration.md`](first-run-integration.md) is secondary (L0 spine bytes, PatternComplete tables, common mistakes) and must not duplicate crossing orchestration prose. [`golden-path.md`](golden-path.md) is index-only.

> **Crossing success is exit 0 from `agentskeptic crossing` in bootstrap-led or pack-led mode. Bootstrap exit 0 alone, IntegrateSpineComplete alone, and PatternComplete alone are not crossing success and are not substitutes for it.**

## Outcome and telemetry

- **Outcome:** A qualified integrator completes **one** integrator-owned verification on non-bundled paths with the **same semantics** as the final phase of standalone **`agentskeptic verify-integrator-owned`** (same `WorkflowResult` schema and batch verify path).
- **Product-activation telemetry** for that **final** phase uses the **`verify_integrator_owned`** subcommand discriminator (same as standalone **`verify-integrator-owned`**). See [`funnel-observability.md`](funnel-observability.md).

**Advanced / CI (not the default integrator story):** **`agentskeptic bootstrap`** and **`agentskeptic verify-integrator-owned`** remain supported; docs must not present standalone bootstrap exit 0 as sufficient “activation” without crossing or an explicit integrator-owned verify.

## Invocation shapes (mutually exclusive)

If argv is invalid, modes conflict, unknown flags appear, or lock flags are passed to **`crossing`**, the CLI writes a **`CROSSING_USAGE`** envelope (first stderr line: one JSON object `{"code":"CROSSING_USAGE","message":"…"}`) and exits **3**.

### A — Bootstrap-led

```text
agentskeptic crossing --bootstrap-input <path> --pack-out <path> (--db <sqlitePath> | --postgres-url <url>) [--no-human-report]
```

### B — Pack-led

```text
agentskeptic crossing --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>) [--no-human-report]
```

- **`--pack-out`:** directory must **not** exist (same rule as **`bootstrap --out`**).
- **No** **`--output-lock`** / **`--expect-lock`** on **`crossing`** (reject with **`CROSSING_USAGE`**, exit **3**).
- **`--no-human-report`:** applies **only** to **phase 2** (final batch verify). Phase 1 follows standalone **`bootstrap`** stderr rules on failure.

## Stdout (entire process)

| Mode | Stdout |
|------|--------|
| **Bootstrap-led** | **At most one** line: the **phase-2** terminal **`WorkflowResult`** JSON object (same schema and serialization as batch verify). The bootstrap **`agentskeptic_bootstrap_result`** envelope is **not** emitted on stdout for **`crossing`** (phase 1 consumes it internally only). |
| **Pack-led** | **Exactly one** line: terminal **`WorkflowResult`** JSON (identical to **`verify-integrator-owned`**). |

If invocation fails with **`CROSSING_USAGE`** or phase 1 fails before a phase-2 **`WorkflowResult`** exists: **no** stdout line from **`crossing`** (stderr only for usage/ops errors).

## Stderr ordering

**Pack-led:** identical order to **`verify-integrator-owned`** for the phase-2 body, then **one** fixed **Decision-ready** pointer block (**`CROSSING_DECISION_READY_FOOTER`** in source). If **`--no-human-report`**: phase-2 stderr is **empty** (no human report and no distribution footer), matching batch verify.

**Bootstrap-led:**

1. **Phase 1:** stderr **only** on bootstrap failure paths—**identical** to standalone **`bootstrap`** (including cleanup messages). On phase-1 success: **no** stderr from phase 1.
2. **Phase 2:** same as pack-led for that phase.
3. **Always last:** **`CROSSING_DECISION_READY_FOOTER`**.

## Exit code mapping

| Condition | Exit |
|-----------|------|
| argv/flag shape invalid; mutually exclusive modes; unknown flags; lock flags on **`crossing`** | **3**; first stderr line = **`CROSSING_USAGE`** envelope |
| Phase 1 | Same exits as standalone **`bootstrap`** today |
| Phase 2 | Same exits as **`verify-integrator-owned`** / batch verify today (`complete` **0**, `inconsistent` **1**, `incomplete` **2**, operational **3**) |
| Phase 2: integrator-owned bundled path gate (**`INTEGRATOR_OWNED_GATE`**) | **2** |

There is **no** exit code that means “phase 1 ok only”; the integrator either gets full crossing success or a phase-specific failure code.

## Degraded mode: phase 1 success, phase 2 failure

- **`--pack-out` directory:** **retained** (not deleted after phase 1 succeeds). Pack contains **`events.ndjson`**, **`tools.json`**, **`quick-report.json`**, **`README.bootstrap.md`** as for standalone bootstrap.
- **stdout:** If phase 2 produces a terminal **`WorkflowResult`** (`inconsistent` / `incomplete`): **that single JSON line** on stdout. If phase 2 fails operationally before **`WorkflowResult`**: stdout **empty**.
- **stderr:** Phase-2 human report (unless **`--no-human-report`**) + mandatory single-line prefix: `agentskeptic-crossing: pack-out retained at <absolute-path> — fix DB/registry or paths, then re-run phase 2:` followed by a **printed** equivalent **`agentskeptic verify-integrator-owned …`** command using resolved absolute paths and the same flags. Then **`CROSSING_DECISION_READY_FOOTER`**.
- **exit:** Phase 2’s code (**1** / **2** / **3**).

## CI / commercial smoke

Hermetic **`crossing`** bootstrap-led against **commercial** `dist/cli.js` with a local license reserve mock runs in **`scripts/commercial-enforce-test-harness.mjs`** (`test/crossing-commercial-smoke.test.mjs`), invoked from the root **`npm test`** chain after **`build-commercial`**.

## Pointers

- Integrator-owned gate and bundled suffixes: [`agentskeptic.md`](agentskeptic.md) (**Integrator-owned gate**).
- Bootstrap pack contract: [`bootstrap-pack-normative.md`](bootstrap-pack-normative.md).
- Decision-ready ProductionComplete (A1–A5): [`adoption-epistemics.md`](adoption-epistemics.md#decision-ready-productioncomplete-normative).
- Optional L0 clone spine (not crossing success): [`first-run-integration.md`](first-run-integration.md#integrate-spine-normative).
