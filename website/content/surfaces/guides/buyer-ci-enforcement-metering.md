---
surfaceKind: guide
guideJob: problem
title: Buyer — CI enforcement and governance — AgentSkeptic
description: On-site summary of stateful baseline, drift, acceptance, metering, and reserve for paid CI enforcement with AgentSkeptic.
intent: Teams adopting paid enforce who need the governance ladder and activation paths without reading the full CI SSOT first.
valueProposition: You see how check differs from enforce, the baseline-to-export ladder, reserve metering, and which site paths to use next.
primaryCta: integrate
route: /guides/buyer-ci-enforcement-metering
evaluatorLens: false
---

## CI enforcement and metering

`agentskeptic enforce` governs correctness over time using product-managed baseline, drift detection, and acceptance state. It requires the commercial npm build, a valid `AGENTSKEPTIC_API_KEY`, and a successful `POST /api/v1/usage/reserve` with `intent=enforce` under an active paid plan. OSS/local `check` (and positional compatibility invocation) remains available for single-run checks, but does not provide authoritative cross-run enforcement state for CI teams.

## Check versus enforce (buyer summary)

- **`agentskeptic check`** — local, stateless, single-run correctness (see [Product boundary](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/ci-enforcement.md#product-boundary) in the CI SSOT).
- **`agentskeptic enforce`** — stateful, paid, correctness over time using hosted baseline and acceptance state (same section).

## Stateful governance ladder (buyer summary)

Authoritative command lines, environment pins, and exit semantics live only under [Stateful workflow](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/ci-enforcement.md#stateful-workflow) in the CI SSOT—do not duplicate them here.

1. **Create baseline** — establish the hosted baseline once; follow **Create baseline** in [Stateful workflow](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/ci-enforcement.md#stateful-workflow).
2. **Run drift checks in CI** — steady `enforce` without `--create-baseline` / `--accept-drift`; follow **Check drift in CI** in [Stateful workflow](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/ci-enforcement.md#stateful-workflow).
3. **Accept intentional change** — use `--accept-drift` with the pinned env vars listed there; follow **Accept intended change** in [Stateful workflow](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/ci-enforcement.md#stateful-workflow).
4. **Export or inspect governance evidence** — timeline and `GovernanceAuditBundleV3` semantics: [governance.md](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/governance.md); hosted export overview: [decision-evidence-bundle.md](https://github.com/jwekavanagh/agentskeptic/blob/main/docs/decision-evidence-bundle.md).

## First commercial actions (site)

- Choose a paid plan and create an API key: [`/pricing`](/pricing) and [`/account`](/account).
- Copy the three-job GitHub Actions layout from [`agentskeptic-commercial.yml`](https://github.com/jwekavanagh/agentskeptic/blob/main/examples/github-actions/agentskeptic-commercial.yml).
- View baselines, events, and export JSON from [`/account/governance`](/account/governance).

## What to do next

- **Stateful CI governance:** confirm a paid plan and create an API key at [`/pricing`](/pricing) and [`/account`](/account); baselines, events, and export live at [`/account/governance`](/account/governance).
- Follow the mechanical first-proof path on [`/integrate`](/integrate) with your prepared database.
- Browse adjacent guides on [`/guides`](/guides) when you need deeper scenarios.
- Compare bundled outcomes at [`/examples/wf-complete`](/examples/wf-complete) and [`/examples/wf-missing`](/examples/wf-missing).
- Read the acquisition narrative at [`/database-truth-vs-traces`](/database-truth-vs-traces) when traces are not enough as proof for buyers.
- Review [`/security`](/security) before you grant database credentials to verification.
