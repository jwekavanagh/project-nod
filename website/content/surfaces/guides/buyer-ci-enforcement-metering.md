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

`agentskeptic enforce` governs correctness over time using product-managed baseline, drift detection, and acceptance state. It requires the commercial npm build, a valid `AGENTSKEPTIC_API_KEY`, and a successful `POST /api/v1/usage/reserve` with `intent=enforce` under an active paid plan. OSS/local `check` (and positional compatibility invocation) remains available for single-run checks, but does not provide authoritative cross-run enforcement state for CI teams.

## What to do next

- Follow the mechanical path on [`/integrate`](/integrate) with your prepared database.
- Browse adjacent guides on [`/guides`](/guides) when you need deeper scenarios.
- Compare bundled outcomes at [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Read the acquisition narrative at [`/database-truth-vs-traces`](/database-truth-vs-traces) when traces are not enough as proof for buyers.
- Review [`/pricing`](/pricing) for metering, API keys, and plan caps before widening production use.
- Review [`/security`](/security) before you grant database credentials to verification.
