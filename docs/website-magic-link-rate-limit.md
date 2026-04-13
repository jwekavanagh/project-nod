# Website — magic link send rate limits (normative)

This document is the **single source of truth** for server-side throttling of magic-link **email sends** on the AgentSkeptic website. It does not change Auth.js verification URL semantics or introduce URL scheme policy beyond what the runner documents below.

## Operator summary

Magic link delivery uses Resend (or Mailpit in E2E). Throttling prevents unbounded sends per recipient email and per client IP within a **UTC calendar hour**, using Postgres as the authority.

When `E2E_COMMERCIAL_FUNNEL=1`, rate reservation is **skipped** so E2E can drive Mailpit without hitting caps (see [commercial-ssot.md](commercial-ssot.md) — Auth email).

## Fixed window burst (product acceptance)

The system uses **fixed UTC hour buckets**, not a sliding 60-minute window. A client may therefore receive up to **twice the per-hour cap** across a clock boundary (e.g. five sends at 00:59 UTC and five more at 01:00 UTC for the same email). This is **accepted** for v1; the non-negotiable goal is eliminating **unbounded** sends, not minimizing burst at the hour rollover.

## Caps (normative)

Per normalized email address, the product allows at most 5 successful reservations per UTC calendar hour.

Per derived client IP, the product allows at most 30 successful reservations per UTC calendar hour.

## Deny semantics

A rate-limited deny rolls back the transaction so stored counters on both scope rows are unchanged from their pre-attempt values.

After a reservation commits, if downstream email delivery fails, counters are not rolled back.

## IP scope

When no client IP can be derived, requests use the scope_key "unknown" for the ip scope.

Header precedence for IP extraction is: `x-forwarded-for` (first hop), then `cf-connecting-ip`, then `x-real-ip`, else `"unknown"`.

## Client-visible rate limit code

The client-visible code for rate limit denial is magic_link_rate_limited.

## Deny log format

Deny logs must be a single console.warn string matching this regular expression: ^\[magic_link_rate_limit\] deny scope=(email|ip) window=\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z key_fp=[0-9a-f]{64}$

The `key_fp` value is the **lowercase 64-character** SHA-256 hex digest of the UTF-8 `scope_key` (email or IP / `unknown`). No raw PII appears in the log line.

## Transactions and retries

Reservations run in SERIALIZABLE transactions with at most five retries on serialization_failure using backoff starting at 5 ms and capped at 80 ms total sleep before surfacing magic_link_rate_limited.

## Runner preconditions (not rate limits)

Before reserveMagicLinkSendSlot, the runner validates only typeof checks and non-empty trimmed identifier using plain Error throws; CredentialsSignin with magic_link_rate_limited is reserved for rate-limit denials from reserveMagicLinkSendSlot.

Exact `Error` messages:

- `Magic link verification: identifier must be a string`
- `Magic link verification: url must be a string`
- `Magic link verification: identifier is empty`

The runner does **not** validate `url` contents (no host or scheme rules). Malformed URLs remain Auth.js / provider concerns.

## Implementation map

- Gate: `website/src/lib/magicLinkSendGate.ts` — `reserveMagicLinkSendSlot`, exported caps `MAGIC_LINK_EMAIL_CAP` / `MAGIC_LINK_IP_CAP`.
- Runner: `website/src/lib/runMagicLinkVerificationRequest.ts` — invoked from Auth.js `sendVerificationRequest` in `website/src/auth.config.ts`.
- Table: `magic_link_send_counter` (Drizzle + `website/drizzle/` migrations).
