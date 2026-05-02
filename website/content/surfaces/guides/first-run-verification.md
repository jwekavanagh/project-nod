---
surfaceKind: guide
guideJob: implementation
title: First-run verification on your database — AgentSkeptic
description: Run npm run first-run-verify after the bundled demo, follow /integrate for crossing commands, and use /openapi-commercial-v1.yaml for the commercial API surface when you meter usage.
intent: Developers who need a concrete path from clone to a successful first verification run on their own SQLite or Postgres database.
valueProposition: This page names the exact npm scripts and canonical URLs so you ship verification without guessing which doc is normative.
primaryCta: integrate
route: /guides/first-run-verification
evaluatorLens: false
---

# First-run verification on your database

Clone the repository, run the bundled demo, then execute **`npm run first-run-verify`** with the environment variables described on [`/integrate`](/integrate). The commercial API contract lives at [`/openapi-commercial-v1.yaml`](/openapi-commercial-v1.yaml) when you are ready to meter usage after local proof.

Lowest-friction path: run agentskeptic quick on captured tool activity first (see /integrate), then graduate to contract check with exported tools.json and events when you need decision-grade highStakesReliance permitted results.

When you finish a first-run verify, you should see crossing output aligned with the integrate spine checklist—a mechanical checkpoint that read-only SQL ran against your prepared database file, not a claim that production emitters are complete. Contract stdout is an Outcome Certificate (schemaVersion 2) that includes evidenceCompleteness.

## What to do next

- Follow the full checklist on [`/integrate`](/integrate) including optional integrator activation commands.
- Browse adjacent guides on [`/guides`](/guides) after you complete the mechanical crossing.
- Compare bundled success and failure at [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Read the acquisition narrative at [`/database-truth-vs-traces`](/database-truth-vs-traces) when stakeholders ask why traces are not sufficient proof.
- Review [`/security`](/security) before you point verify at sensitive databases.
