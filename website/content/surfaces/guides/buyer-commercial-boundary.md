---
surfaceKind: guide
guideJob: problem
title: Buyer — commercial boundary and evaluation path — AgentSkeptic
description: On-site summary of OSS versus paid CLI boundaries and where to run /integrate before upgrading at /pricing.
intent: Buyers who need one page for commercial gating facts and the evaluation spine without reading the full commercial SSOT.
valueProposition: You see which commands require reserve metering, how Starter behaves, and which canonical site paths to follow next.
primaryCta: pricing
route: /guides/buyer-commercial-boundary
evaluatorLens: false
---

## Commercial boundary

The **published npm CLI** path for licensed contract **`verify`** and **`quick`** with lock flags uses a valid API key and a successful **`POST /api/v1/usage/reserve`**. **Starter** includes a **finite free** monthly allowance for licensed **`verify`** (see [`config/commercial-plans.json`](../config/commercial-plans.json)); **`enforce`** and **`--expect-lock`** require a **paid** plan with an **active** Individual, Team, Business, or Enterprise subscription (Stripe **trialing** counts). The default **OSS** build runs contract **`verify`** / **`quick`** without a license server and can emit **`--output-lock`** fixtures. **Paid** plans add **metered overage** after the included amount (Stripe subscription has a **base** Price + **metered** overage Price; see `scripts/stripe-bootstrap.mjs`). Full matrix: *Free vs paid boundary* below.

In-process **`createDecisionGate`** in your application evaluates read-only SQL and **does not** call the reserve API; metering applies to the **CLI entry points** that perform license preflight.

## Evaluation path

Run the mechanical first-run path on the canonical site at **`/integrate`** (clone, build, bundled demo, then crossing on your prepared SQLite or Postgres). When you need Stripe-backed metering, API keys, and plan caps, use **`/pricing`** on the same site and keep this repository’s **commercial SSOT** (`docs/commercial.md`) as the normative contract for entitlements.

## What to do next

- Follow the mechanical path on [`/integrate`](/integrate) with your prepared database.
- Browse adjacent guides on [`/guides`](/guides) when you need deeper scenarios.
- Compare bundled outcomes at [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Read the acquisition narrative at [`/database-truth-vs-traces`](/database-truth-vs-traces) when traces are not enough as proof for buyers.
- Review [`/pricing`](/pricing) for metering, API keys, and plan caps before widening production use.
- Review [`/security`](/security) before you grant database credentials to verification.
