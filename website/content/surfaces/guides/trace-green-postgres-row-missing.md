---
surfaceKind: guide
guideJob: problem
title: Green LangGraph trace but missing Postgres row — AgentSkeptic
description: When traces look green but the Postgres row is wrong or absent, use read-only SQL verification against structured tool activity—not trace success flags.
intent: Operators who see green LangGraph or agent traces while customer-visible Postgres rows are missing or stale.
valueProposition: You learn how ROW_ABSENT surfaces before you trust customer-facing outcomes or downstream automation.
primaryCta: integrate
route: /guides/trace-green-postgres-row-missing
evaluatorLens: false
---

# Green trace, missing Postgres row

LangGraph **checkpoint trust** contracts (v3 wire, CLI flag, terminal table) are defined in [`docs/langgraph-checkpoint-trust.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/langgraph-checkpoint-trust.md); this guide stays symptom-first.

Green LangGraph or agent trace but wrong or missing Postgres row

When your graph finishes with a green step list, you still need a read-only check that the row your business logic cares about is present in Postgres with the expected columns. Traces record what the runtime believed happened; they do not substitute for SELECT results at verification time.

AgentSkeptic ingests structured tool activity as NDJSON or JSON, derives expected row identity from your registry, and runs read-only SQL. A missing row surfaces as inconsistent with reason ROW_ABSENT even when the trace narrative looked successful. Use this pattern after LangGraph runs, before you treat outcomes as safe for customers or downstream automation.

Start from the bundled demo contrast (wf_complete vs wf_missing), then wire your own tool IDs and tables. First-run on your database is documented at /integrate; contract mode with a registry is the audit-grade path when you need explicit per-tool expectations rather than inferred checks from Quick Verify.

Operational teams often discover this gap only after a silent failure: the ticket never moved, the contact never landed, or analytics disagrees with CRM. Running verification as a gate catches that class before release trains or compliance sign-off, without pretending the trace proves causality.

## What to do next

- Follow [`/integrate`](/integrate) for first-run commands on your database.
- Compare bundled proof at [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Return to the Learn hub at [`/guides`](/guides) for adjacent failure patterns.
- Review [`/security`](/security) before widening database access.
