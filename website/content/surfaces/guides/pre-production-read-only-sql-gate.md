---
surfaceKind: guide
guideJob: problem
title: Pre-production read-only SQL gate — AgentSkeptic
description: Before customer-facing or regulated actions, gate on authoritative SELECT results from structured tool activity—not another latency dashboard tile.
intent: Teams shipping refunds, entitlements, or regulated toggles who need read-only verification after replay or deploy.
valueProposition: ROW_ABSENT becomes the blunt signal that narrative success and persisted rows disagree even when traces looked fine.
primaryCta: integrate
route: /guides/pre-production-read-only-sql-gate
evaluatorLens: false
---

# Pre-production read-only SQL gate

Need a gate before production: read-only verification, not more log volume

Before customer-facing or regulated actions, you need a gate that reads authoritative tables with SELECT, not another dashboard tile about latency. AgentSkeptic answers whether persisted rows match expectations derived from structured tool activity at verification time.

Schedule verification after replay or after the live workflow when stakes are high: refunds, account state, entitlement toggles, or anything where a wrong row creates liability. ROW_ABSENT is the blunt signal that the story and the database disagree even when traces looked fine.

Keep the registry the contract for what each tool implies in SQL. Quick Verify can help early exploration, but contract mode is the durable story when legal or SRE review asks what was checked. Share private /r/ links only for ticket context; indexed discovery lives on these guides and the acquisition page.

Operational discipline is to run read-only checks against the same schema version you ship, with credentials scoped to SELECT, and to archive the Outcome Certificate JSON (contract stdout, schemaVersion 2) and the human report for later diffing.

## What to do next

- Promote the gate using commands on [`/integrate`](/integrate).
- Compare bundled proof on [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Read acquisition framing at [`/database-truth-vs-traces`](/database-truth-vs-traces).
- Confirm trust posture on [`/security`](/security).
