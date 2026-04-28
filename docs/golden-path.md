# Golden integration path (Next.js + Postgres)

This is the single canonical onboarding path for AgentSkeptic:

- Stack: **Next.js (App Router) + Postgres**
- Goal: reach a real verification outcome on your own system in one sitting
- Contract: if you follow these steps, you will get either a trusted pass or an actionable mismatch

All other stack combinations are contract-based only and are out of scope for this first-run path.

Default decision-gate path reference: [README — Default path: DecisionGate before you act](../README.md#default-path-decisiongate-before-you-act).

<!-- epistemic-contract:consumer:golden-path -->
**Epistemic framing (pointer only):** [`epistemic-contract.md`](epistemic-contract.md) — then follow adoption and product SSOT below.
<!-- /epistemic-contract:consumer:golden-path -->

## 1) Clone and install

```bash
git clone https://github.com/jwekavanagh/agentskeptic.git
cd agentskeptic
npm ci
npm run build
```

## 2) Enter the reference app

```bash
cd examples/golden-next-postgres
cp .env.example .env
```

Edit `.env` and set `POSTGRES_ADMIN_URL` to a local/admin-safe Postgres URL.

## 3) Run the deterministic reference flow

```bash
npm run golden:path
```

This command:

1. Creates an isolated Postgres database for the reference run
2. Seeds known-good state
3. Runs a passing verification (`VERDICT: complete`, trusted)
4. Runs a failing verification (`ROW_ABSENT` evidence)

## 4) What success looks like

Expected observable evidence in stdout:

- Pass run includes `VERDICT: complete`
- Fail run includes `ROW_ABSENT`
- Script exits `0` only when both checks behave as expected

## 5) Port into your app

Copy the reference route pattern from:

- `examples/golden-next-postgres/app/api/verify/route.ts`

Keep these files in your app:

- `agentskeptic/tools.json` (registry)
- your emitted NDJSON events
- Postgres URL in `DATABASE_URL`

## 6) Boundaries and guarantees

- Canonical product guidance: [`integrate.md`](integrate.md)
- Guided browser drafting flow (subordinate, optional): [`guided-first-verification.md`](guided-first-verification.md)
- Decision-ready production framing: [`adoption-epistemics.md#decision-ready-productioncomplete-normative`](adoption-epistemics.md#decision-ready-productioncomplete-normative)
- Verification semantics and contract framing: [`epistemic-contract.md`](epistemic-contract.md)
