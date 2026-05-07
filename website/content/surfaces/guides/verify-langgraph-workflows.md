---
surfaceKind: guide
guideJob: problem
title: Verify LangGraph workflows against your database — AgentSkeptic
description: LangGraph checkpoint trust mode maps structured tool activity to v3 NDJSON, read-only SQL verification, and checkpoint-scoped Outcome Certificates.
intent: Teams running LangGraph or similar graphs who need Postgres or SQLite rows to match structured tool parameters at verification time.
valueProposition: Checkpoint trust mode gives one approval-grade stdout contract and separates trace success from database truth.
primaryCta: integrate
route: /guides/verify-langgraph-workflows
evaluatorLens: false
---

# Verify LangGraph workflows against your database

**See a verified certificate on-site:** open **[`/examples/langgraph-checkpoint-trust`](/examples/langgraph-checkpoint-trust)** for a captured B-row Outcome Certificate (checkpoint verdicts, `runKind: contract_sql_langgraph_checkpoint_trust`) before reading any GitHub SSOT.

Stdout Outcome Certificates are **v3** (**schemaVersion: 3**) with **failureSpine** and **evidenceCompleteness** — the same convergence story as vanilla contract **`agentskeptic check`** runs, including checkpoint trust `runKind` rows.

**Integrator primacy:** runnable Python-first narration lives in **[`examples/python-verification/README.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/examples/python-verification/README.md)**. Canonical integrator onboarding and the **`#framework-verification-recipes`** index live in **[`docs/integrate.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/integrate.md#framework-verification-recipes)**. Checkpoint trust statutes (v3 wire, terminal rows **A1–D**, **`--langgraph-checkpoint-trust`**, eligibility, production gate, shared capability matrix with SQL verification) reside in **`docs/integrator-verification.md`**—anchor **[`docs/integrator-verification.md#langgraph-checkpoint-trust`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/integrator-verification.md#langgraph-checkpoint-trust)** keeps experience reading here while statute text stays authoritative. **Additional SQL engines and state stores** (MySQL, BigQuery, SQL Server, vectors, S3, HTTP witnesses, MongoDB): [`docs/verification-state-stores.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/verification-state-stores.md). Generated **[`docs/partner-quickstart-commands.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/partner-quickstart-commands.md)** still carries the **Node oracle** shell for CI regression only.

**Documentation boundaries** (what belongs in which doc): [`docs/langgraph-reference-boundaries.md`](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/langgraph-reference-boundaries.md).

## What to do next

- Run first-run on your database via [`/integrate`](/integrate).
- Open pricing when you need metered commercial usage at [`/pricing`](/pricing).
- Read trust boundaries on [`/security`](/security).
