# Verification product — authority stub (legacy URL)

**Authority moved.** Public verification artifact field semantics, trust boundary, ICP, `runKind` / `stateRelation` / `highStakesReliance` rules, and **`evidenceCompleteness`**: **[`outcome-certificate-normative.md`](outcome-certificate-normative.md)**. Integrator commands, CLI stdout/stderr, share **v3** envelope, and CI gates: **[`outcome-certificate-integrator.md`](outcome-certificate-integrator.md)**.

**Epistemic contract** (grounded output vs telemetry): [`epistemic-contract.md`](epistemic-contract.md). **Adoption epistemics** (four-way model, **Decision-ready ProductionComplete**, cohort checklist): [`adoption-epistemics.md`](adoption-epistemics.md). **LangGraph reference boundaries** (emitter contract, CI verify driver): [`langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md).

| Former section in this file | Now canonical in |
|------------------------------|-------------------|
| Trust boundary, core promise | `outcome-certificate-normative.md` |
| Quick vs contract positioning (reliance) | `outcome-certificate-normative.md` |
| Integrator stdout / stderr / exit codes | `outcome-certificate-integrator.md` |
| Share POST/GET | `shareable-verification-reports.md` + normative share note in `outcome-certificate-normative.md` |

**Decision-ready ProductionComplete** remains defined only in [`adoption-epistemics.md`](adoption-epistemics.md#decision-ready-productioncomplete-normative) (artifacts **A1–A5**); **A1** is the terminal **Outcome Certificate v2** on stdout for contract verify. Operational file layout for retained proof: [`decision-evidence-bundle.md`](decision-evidence-bundle.md).

<!-- buyer-surface-trust-production-implications:begin -->

## Trust and production implications

Verification compares **declared structured tool activity** to **read-only `SELECT` results at verification time** under your registry rules. A **green** verdict means observed SQL **matched expectations then**—not that a particular HTTP request **caused** a row, and not that the database will stay unchanged afterward. **Quick** outputs are not interchangeable with **contract Outcome Certificates** for high-stakes reliance; use **contract mode** when a human decision depends on the artifact. Normative field semantics and **`highStakesReliance`**: **`docs/outcome-certificate-normative.md`**. Integrator streams and share surfaces: **`docs/outcome-certificate-integrator.md`**.

Contract Outcome Certificate JSON uses schemaVersion 2 and includes evidenceCompleteness: verified vs unverified claims, blockers, missing inputs, and next actions in one object. Quick remains preview-only for high-stakes reliance (see highStakesReliance in the normative doc).

<!-- buyer-surface-trust-production-implications:end -->
