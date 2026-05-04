# Verification product — authority stub (legacy URL)

**Authority moved.** Public verification artifact field semantics, trust boundary, ICP, `runKind` / `stateRelation` / `highStakesReliance` rules, and **`evidenceCompleteness`**: **[`outcome-certificate-normative.md`](outcome-certificate-normative.md)**. Integrator commands, CLI stdout/stderr, share **v3** envelope, and CI gates: **[`outcome-certificate-integrator.md`](outcome-certificate-integrator.md)**.

**Epistemic contract** (grounded output vs telemetry): [`epistemic-contract.md`](epistemic-contract.md). **Adoption epistemics** (four-way model, **Decision-ready ProductionComplete**, cohort checklist): [`adoption-epistemics.md`](adoption-epistemics.md). **LangGraph reference boundaries** (emitter contract, CI verify driver): [`langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md).

| Former section in this file | Now canonical in |
|------------------------------|-------------------|
| Trust boundary, core promise | `outcome-certificate-normative.md` |
| Quick vs contract positioning (reliance) | `outcome-certificate-normative.md` |
| Integrator stdout / stderr / exit codes | `outcome-certificate-integrator.md` |
| Share POST/GET | `shareable-verification-reports.md` + normative share note in `outcome-certificate-normative.md` |

**Decision-ready ProductionComplete** remains defined only in [`adoption-epistemics.md`](adoption-epistemics.md#decision-ready-productioncomplete-normative) (artifacts **A1–A5**); **A1** is the terminal **Outcome Certificate v3** on stdout for contract verify. Operational file layout for retained proof: [`decision-evidence-bundle.md`](decision-evidence-bundle.md).

<!-- buyer-surface-trust-production-implications:begin -->

## Trust and production implications

**Canonical copy:** [`outcome-certificate-normative.md`](outcome-certificate-normative.md) (trust boundary, quick vs contract, `highStakesReliance`, **`evidenceCompleteness`**) and [`verification-state-stores.md`](verification-state-stores.md) (which registry `verification.kind` values exist and what “observed” means per kind). In one line: contract verification compares declared tool activity to **read-only observed downstream state** at verify time (SQL **and** configured HTTP / object / vector / Mongo witnesses); **Quick** is SQL-inference preview only and is **not** interchangeable with contract certificates for high-stakes reliance. Contract Outcome Certificate JSON is **schemaVersion 2** on the inner certificate with the same **`evidenceCompleteness`** shape you see on quick stderr when enabled.

<!-- buyer-surface-trust-production-implications:end -->
