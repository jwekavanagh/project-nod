---
surfaceKind: scenario
guideJob: problem
title: When green traces hide a missing Postgres row — AgentSkeptic
description: Failure-led walkthrough for LangGraph-style green traces with absent or stale Postgres rows at verification time.
intent: On-call engineers searching for green trace missing Postgres row symptoms before they close customer tickets.
valueProposition: You rehearse the ROW_ABSENT signal and tie it to read-only SQL checks instead of trace color alone.
primaryCta: demo
route: /guides/scenario-green-trace-row-missing
evaluatorLens: false
symptomLead: When your LangGraph trace lists every step as successful yet the Postgres row your workflow implied is still missing at verification time
---

# When green traces hide a missing Postgres row

When your LangGraph trace lists every step as successful yet the Postgres row your workflow implied is still missing at verification time, treat the trace as narrative—not ledger proof. Normative LangGraph checkpoint trust behavior: [`docs/langgraph-checkpoint-trust.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/langgraph-checkpoint-trust.md). Export structured tool parameters, run read-only `SELECT`s against the same database, and expect ROW_ABSENT when the declared identity is absent.

## What to do next

- Run the interactive demo at [`/verify`](/verify) to see the failure-shaped transcript.
- Run first-run commands on [`/integrate`](/integrate) against your own SQLite or Postgres file.
- Compare bundled envelopes at [`/examples/wf-missing`](/examples/wf-missing).
- Read trust boundaries on [`/security`](/security).
