---
surfaceKind: guide
guideJob: problem
title: Buyer — CI enforcement and metering — AgentSkeptic
description: On-site summary of lock pinning, enforce gating, and reserve metering for CI pipelines using AgentSkeptic.
intent: Teams wiring CI who need the same metering facts as docs/ci-enforcement.md without leaving the marketing site.
valueProposition: You see how output-lock and expect-lock relate to OSS versus commercial builds and the license reserve API.
primaryCta: integrate
route: /guides/buyer-ci-enforcement-metering
evaluatorLens: false
---

## CI enforcement and metering

**`agentskeptic enforce`** and **`--expect-lock`** on batch or quick verification require the **commercial** npm build, a valid **`AGENTSKEPTIC_API_KEY`**, and a successful **`POST /api/v1/usage/reserve`** with an active paid plan (Individual, Team, Business, or Enterprise—including **trialing**). Generate lock fixtures with **`--output-lock`** on **`verify`** or **`quick`** (OSS or commercial), then pin CI by re-running with **`--expect-lock`** or by invoking **`enforce`** against the committed **`ci-lock-v1`** file. Each allowed run consumes (or idempotently reuses) quota per **`run_id`** on the license API. OSS builds **cannot** enforce or expect-lock on the published npm path—see **`docs/commercial-enforce-gate-normative.md`**.

## What to do next

- Follow the mechanical path on [`/integrate`](/integrate) with your prepared database.
- Browse adjacent guides on [`/guides`](/guides) when you need deeper scenarios.
- Compare bundled outcomes at [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Read the acquisition narrative at [`/database-truth-vs-traces`](/database-truth-vs-traces) when traces are not enough as proof for buyers.
- Review [`/pricing`](/pricing) for metering, API keys, and plan caps before widening production use.
- Review [`/security`](/security) before you grant database credentials to verification.
