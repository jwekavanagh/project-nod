# Commercial entitlement policy

This document is the **hand-authored** source for **why** the product gates certain capabilities. Machine-readable entitlement rows live in [`config/commercial-entitlement-matrix.v1.json`](../config/commercial-entitlement-matrix.v1.json). The generated table is [`commercial-entitlement-matrix.md`](commercial-entitlement-matrix.md).

The **OSS** default build does not expose **`enforce`** (exit **`ENFORCE_REQUIRES_COMMERCIAL_BUILD`**); entitlement rows below apply to **commercial** CLI builds. See **[`docs/commercial-enforce-gate-normative.md`](commercial-enforce-gate-normative.md)**.

## Why licensed `verify` requires an active subscription

Batch and quick **verification** with the **published npm** package (`intent=verify` on `POST /api/v1/usage/reserve`) is the **primary product outcome**. It requires an **active** Stripe-backed subscription on **Individual, Team, Business, or Enterprise** (including **trialing**). **Starter** accounts may sign in and obtain an API key but **cannot** pass license preflight for `verify` until they subscribe (`VERIFICATION_REQUIRES_SUBSCRIPTION`). **Monthly quota** still applies after entitlement allows the run.

**OSS builds** from source (`WF_BUILD_PROFILE=oss`) do not call the license server and are not subscription-gated—see README and [`commercial-enforce-gate-normative.md`](commercial-enforce-gate-normative.md).

## Why `enforce` and CI locks share the same paid gate

**Enforcement** (`workflow-verifier enforce …`, `intent=enforce`) and **CI lock** flags on batch/quick verify (`--output-lock` / `--expect-lock`) use **`intent=enforce`** on reserve. Both require the same **active subscription** on a paid-capable plan as licensed `verify`.

## Why `starter` cannot `verify` or `enforce` on commercial npm

The **starter** plan is an **account + upgrade path** only on the commercial surface. **`verify`** returns `VERIFICATION_REQUIRES_SUBSCRIPTION`; **`enforce`** returns `ENFORCEMENT_REQUIRES_PAID_PLAN`, each with an upgrade URL.

## `RESERVE_EMERGENCY_ALLOW`

When `RESERVE_EMERGENCY_ALLOW=1` on the server, the **subscription check for paid-plan `verify` and `enforce`** is waived (operations break-glass). **Starter `verify` and `enforce` remain denied.** **Quota and idempotency still apply**—emergency does not bypass monthly limits.

## Pricing surface (normative user-visible lines)

The `/pricing` page must show the following two lines **verbatim** (drift is caught by `test/commercial-pricing-policy-parity.test.mjs` and Playwright).

<!-- commercial-pricing-lines-begin -->
Licensed verification with the published npm CLI requires an active Individual, Team, Business, or Enterprise subscription (trial counts); monthly quota applies after subscribe.
CI locks, the enforce command, and quick verify with lock flags use the same subscription requirement.
<!-- commercial-pricing-lines-end -->
