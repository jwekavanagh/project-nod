# First-run integration

Checklist anchors: **PatternComplete**, **AdoptionComplete_PatternComplete**, **AC-TRUST-01**, **AC-OPS-01**, **IntegrateSpineComplete**.

Epistemic framing: [`docs/epistemic-contract.md`](epistemic-contract.md). Adoption verdict norms: [`docs/adoption-epistemics-ssot.md`](adoption-epistemics-ssot.md), including [Decision-ready ProductionComplete (normative)](adoption-epistemics-ssot.md#decision-ready-productioncomplete-normative).

The full L0 script **exit code is 0** iff every step completes, including the **final** `node dist/cli.js bootstrap … --input examples/integrate-your-db/bootstrap-input.json` and the following **`crossing`** pack-led on `"$AGENTSKEPTIC_VERIFY_DB"` (same event/registry/db flags as contract batch verify; integrator-owned gate per [`agentskeptic.md`](agentskeptic.md) Integrator-owned gate; final-phase telemetry matches **`verify_integrator_owned`** per [`crossing-normative.md`](crossing-normative.md)).

**Authority:** integrator lifecycle, trust gating, telemetry, and CI replay live in **[`docs/decision-gate-ssot.md`](decision-gate-ssot.md)**.

Prerequisite framing: [README wedge](../README.md#buy-vs-build-why-not-only-sql-checks).

```bash
npm start
```

Commercial follow-ups: Stripe billing, `AGENTSKEPTIC_API_KEY`, `POST /api/v1/usage/reserve`.
