# OSS account claim bridge — single source of truth

Normative contract for converting **anonymous OSS CLI verification** into an **identified account** by binding a `run_id` to `user_id` after email sign-in. Commercial npm builds (`LICENSE_PREFLIGHT_ENABLED`) do not use this surface: they require an API key before verify.

**Not duplicated here:** North-star funnel definitions remain in [`funnel-observability-ssot.md`](funnel-observability-ssot.md) and [`growth-metrics-ssot.md`](growth-metrics-ssot.md). This document is the only SSOT for claim URLs, claim HTTP semantics, rate limits, and retention.

---

## Audiences

### Engineer

| Surface | Method | Path | Auth |
|---------|--------|------|------|
| Register claim ticket | `POST` | `/api/oss/claim-ticket` | None (CLI headers + JSON body) |
| Browser handoff (mint pending cookie) | `GET` | `/verify/link` | None (opaque query token `h` only) |
| CLI spawn ack (interactive human only) | `POST` | `/api/oss/claim-continuation` | None (CLI headers + JSON `claim_secret`) |
| Redeem ticket | `POST` | `/api/oss/claim-redeem` | Session (NextAuth) |
| Claim UI | `GET` | `/claim` | None (static shell + client behavior) |

**CLI POST origin (v1):** `resolveOssClaimApiOrigin()` in the CLI package returns **only** `PUBLIC_CANONICAL_SITE_ORIGIN` from anchor sync ([`src/publicDistribution.generated.ts`](../src/publicDistribution.generated.ts)), trailing slash stripped. **No** `AGENTSKEPTIC_TELEMETRY_ORIGIN`, **no** `LICENSE_API_BASE_URL`, **no** env override.

**stderr URL (OSS only):** After a successful quick or batch verify, when license preflight is disabled, stderr claim emission is enabled, and **`AGENTSKEPTIC_TELEMETRY` is not `0`**, the CLI prints one line with the **server-issued** HTTPS **`handoff_url`** (never a `#fragment`):

`[agentskeptic] Link this verification run to your account: <handoff_url> — open the link, then sign in with email when prompted.`

- **`handoff_url`** is **`GET`** `…/verify/link?h=<opaque>` on the canonical origin. The **`h`** value is **not** derivable from `run_id` and is **not** the wire `claim_secret`.
- **stdout** must remain machine JSON only for batch/quick; claim text is **stderr only**.
- **`AGENTSKEPTIC_TELEMETRY=0`:** no stderr line from this helper and **no** claim-ticket `fetch` (silent), matching the product-activation opt-out in [`docs/funnel-observability-ssot.md`](funnel-observability-ssot.md).

**Normative browser path:** Open **`handoff_url`** once in the same browser profile you will use for magic link. The **`GET`** handler validates **`h`**, rate-limits by IP, sets **`handoff_consumed_at`** for the current token, and responds **`302`** to **`/auth/signin?callbackUrl=/claim`** (encoded as required) with **`Set-Cookie: __Host-as_pc_v1`** (signed envelope; implementation [`website/src/lib/ossClaimPendingCookie.ts`](../website/src/lib/ossClaimPendingCookie.ts), mint helper [`website/src/lib/ossClaimPendingMint.ts`](../website/src/lib/ossClaimPendingMint.ts)). After sign-in, **`GET /claim`** runs **`POST /api/oss/claim-redeem`** with body **`{}`** and `credentials: 'include'`.

**`/claim` query errors:** Failed or replayed handoffs redirect to **`/claim?error=handoff_invalid`** or **`/claim?error=handoff_used`** with the pending cookie cleared. Copy for each case lives in **`productCopy.ossClaimPage`**.

**`__Host-` + HTTPS:** Real browsers only persist `__Host-` cookies on **HTTPS** origins. Manual QA uses the canonical HTTPS site. Automated tests invoke route handlers directly.

#### `POST /api/oss/claim-ticket`

- **Headers:** Same as [`POST /api/funnel/product-activation`](../website/src/app/api/funnel/product-activation/route.ts): `X-AgentSkeptic-Product: cli`, `X-AgentSkeptic-Cli-Version` semver, `Content-Type: application/json`.
- **Body (JSON):** discriminated by **`schema_version`** (see [`website/src/lib/ossClaimTicketPayload.ts`](../website/src/lib/ossClaimTicketPayload.ts)):
  - **v1 (legacy):** `{ claim_secret, run_id, issued_at, terminal_status, workload_class, subcommand, build_profile }` — enums align with product-activation outcome payload; **no** `schema_version` key on the wire.
  - **v2:** v1 fields plus **`"schema_version": 2`** and required **`telemetry_source`**: `"local_dev"` \| `"unknown"`. Reject **`legacy_unattributed`** on the wire (**`400`**). Optional **`interactive_human`**: when **`true`**, the row is in the mint-time interactive-human cohort (`interactive_human_claim`); see [`docs/eval-to-revenue-journey-ssot.md`](eval-to-revenue-journey-ssot.md).
- **Persistence:** on first insert, nullable column **`telemetry_source`** is set from the v2 body or to **`legacy_unattributed`** for v1 rows. Each row has **`handoff_token`** (opaque) and nullable **`handoff_consumed_at`** for the **current** token lifecycle; **`interactive_human_claim`** (boolean, default false) from optional body **`interactive_human`**; nullable **`browser_open_invoked_at`** set once by **`POST /api/oss/claim-continuation`** for interactive rows.
- **`issued_at` skew:** ±300s vs server time (same constant as product-activation).
- **Responses (Contract B):**
  - **`200`** `application/json` **`{ "schema_version": 2, "handoff_url": "<canonical GET URL>" }`** when a row exists with **`claimed_at` null** — including **first insert** and **duplicate POST** with the same `claim_secret` (**same `secret_hash`**):
    - If **`handoff_consumed_at` is null**, **`handoff_url`** is rebuilt from the **existing** `handoff_token` (no rotation).
    - If **`handoff_consumed_at` is set** (GET already consumed the current token but redeem not finished), the server **rotates** `handoff_token` in place and clears **`handoff_consumed_at`**; **`handoff_url`** uses only the new token. Prior **`h`** strings are not stored; **`GET`** with an old token behaves like an unknown token (**`handoff_invalid`**).
  - **`204`** empty body **only** when **`claimed_at` is set** (terminal idempotency for a fully claimed ticket).
  - **`400`** / **`403`** / **`413`** empty body where aligned with product-activation; **`429`** JSON `{ "code": "rate_limited", "scope": "claim_ticket_ip" }`.

**CLI bounded retry:** `postOssClaimTicket` retries transient failures reusing the **same** `claim_secret` so a flap after the server persisted the row still yields **`200`** with a redeemable URL when appropriate.

#### `GET /verify/link`

- **Query:** **`h` only** (trimmed, bounded length). No `claim_secret` in the query string.
- **Lookup:** At most one row with **`handoff_token = :h`**. No secondary lookup for retired tokens.
- **Redirects (302 `Location`):**
  - No row, expired, or already **`claimed_at`:** **`/claim?error=handoff_invalid`**, clear pending cookie.
  - Row valid but **`handoff_consumed_at` set:** **`/claim?error=handoff_used`**, clear pending cookie.
  - Row valid and **`handoff_consumed_at` null:** **`302`** to sign-in URL above, **`Set-Cookie`** minted pending envelope, **`handoff_consumed_at = now()`** in the same **serializable** transaction (after IP rate-limit reservation).
- **Rate limit:** **`429`** JSON `{ "code": "rate_limited", "scope": "claim_handoff_ip" }` — same numeric cap per UTC hour as the legacy browser stash cap (constant in [`website/src/lib/ossClaimRateLimits.ts`](../website/src/lib/ossClaimRateLimits.ts)).

#### `GET /api/oss/claim-handoff` (legacy compatibility)

- **Normative behavior:** **`308`** **`Location`** to **`/verify/link?h=<same h>`** — **no** DB access on this path. Bookmarks continue to work; steady-state URLs use **`/verify/link`** only.

#### `POST /api/oss/claim-continuation`

- **Headers:** Same CLI product headers as **`POST /api/oss/claim-ticket`**.
- **Body:** **`{ "claim_secret": "<64 lowercase hex>" }`** (strict JSON).
- **When `interactive_human_claim` is false:** **`403`** JSON `{ "code": "continuation_not_applicable" }`.
- **When valid and `browser_open_invoked_at` is null:** set **`browser_open_invoked_at = now()`** once; respond **`204`**.
- **Idempotent repeat:** **`204`** if already set.

#### `POST /api/oss/claim-redeem`

- **Credential resolution (deterministic):**
  1. If cookie **`__Host-as_pc_v1`** verifies and parses, use payload **`h`** as `secret_hash` (ignore JSON `claim_secret` even if present).
  2. Else if body contains valid **`claim_secret`**, use `hashOssClaimSecret(claim_secret)` (for tests / non-browser callers).
  3. Else **`400`** `{ "code": "claim_failed" }`.
- **Browser `/claim` client:** sends **`{}`** only; success path is cookie-only after **`GET` handoff**.
- **Unauthenticated:** **`401`** empty body — **do not** set or clear `__Host-as_pc_v1` (user may sign in next).
- **Success / idempotent (same user):** **`200`** JSON (shape unchanged). Response includes **`Set-Cookie`** clearing **`__Host-as_pc_v1`**.
- **Cross-user conflict:** **`409`** `{ "code": "already_claimed" }` + clear pending cookie.
- **Other failures:** **`400`** `{ "code": "claim_failed" }` + clear pending cookie.
- **Rate limit:** **`429`** `{ "code": "rate_limited", "scope": "claim_redeem_user" }` + clear pending cookie.
- **Server error:** **`503`** + clear pending cookie.

**DB tables**

- **`oss_claim_ticket`:** `secret_hash` PK (SHA-256 hex of UTF-8 `claim_secret`), outcome columns, `issued_at` text, `created_at`, `expires_at`, nullable `claimed_at` / `user_id`, nullable **`telemetry_source`**, nullable **`handoff_token`** (unique when present), nullable **`handoff_consumed_at`**, **`interactive_human_claim`** (boolean), nullable **`browser_open_invoked_at`**.
- **`oss_claim_rate_limit_counter`:** PK `(scope, window_start, scope_key)`; `scope` includes `claim_ticket_ip` \| `claim_handoff_ip` \| `claim_redeem_user` \| `registry_draft_ip` \| `public_funnel_anon_ip`; `window_start` = UTC hour start (same convention as magic-link counters).

**Rate caps (fixed constants in [`website/src/lib/ossClaimRateLimits.ts`](../website/src/lib/ossClaimRateLimits.ts)):**

| Scope | Cap / UTC hour |
|-------|------------------|
| `claim_ticket_ip` | 60 new tickets per client IP key |
| `claim_handoff_ip` | 30 GET handoff attempts per client IP key |
| `claim_redeem_user` | 30 successful first-time binds per `user_id` |

**Client IP key:** [`extractClientIpKey`](../website/src/lib/magicLinkSendGate.ts) — first `X-Forwarded-For` hop, else `CF-Connecting-IP`, else `X-Real-IP`, else literal `unknown` (shared bucket when proxy headers are absent).

**TTL:** `expires_at = created_at + 72h` (`OSS_CLAIM_TICKET_TTL_MS` in [`website/src/lib/ossClaimTicketTtl.ts`](../website/src/lib/ossClaimTicketTtl.ts)). Pending envelope `exp` is `min(now + 900s, ticket_expires_at − 60s)` (see [`website/src/lib/ossClaimPendingCookie.ts`](../website/src/lib/ossClaimPendingCookie.ts)).

**Funnel:** On first successful bind, insert `funnel_event` `oss_claim_redeemed` with `user_id` and `{ schema_version: 1, run_id }`.

**Degraded UX (single copy):** If redeem returns **`claim_failed`** while authenticated (missing/expired cookie, wrong device, cleared cookies), the UI shows **`productCopy.ossClaimPage.pendingHandoffMissing`** — open the terminal **`handoff_url`** again on the same device or re-verify.

### Integrator

This flow is **not** part of [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml). Embedded integrators must not depend on claim routes.

### Operator

**Retention (v1):** No automatic deletion of `oss_claim_ticket` rows. Counting:

- **Claimed:** `claimed_at IS NOT NULL`
- **Active unclaimed:** `claimed_at IS NULL AND expires_at > now()`
- **Expired unclaimed:** `claimed_at IS NULL AND expires_at <= now()`

**Operator aggregates excluding local dev noise:** when counting tickets that represent non-local operator traffic, filter with **`telemetry_source IS DISTINCT FROM 'local_dev'`** (and remember **`unknown`** is not a guarantee of “external-only” origin—see [`docs/funnel-observability-ssot.md`](funnel-observability-ssot.md)).

**Handoff health (examples):**

- Handoff GET volume: correlate `claim_handoff_ip` counter rows with redirects and redeem success.
- Conversion: `SELECT count(*) FROM oss_claim_ticket WHERE claimed_at IS NOT NULL;` and `funnel_event` where `event = 'oss_claim_redeemed'`.

**Post-deploy validation (material gates):** After shipping the GET handoff + CLI stderr change, operators run the rolling SQL checks and duplicate-recover smoke steps documented in the implementation plan (PR1 identity throughput and recoverability). CI proves handler contracts; production thresholds are operator-owned.

---

## Why these decisions

- **Canonical-only claim POST:** Avoids split-origin drift between telemetry and claim in v1; operators who send telemetry elsewhere still register tickets on the public canonical site until a future explicit env is introduced.
- **High-entropy `claim_secret` vs `run_id`:** `run_id` may be operator-chosen (CI job id); it must never be the sole bearer for binding.
- **Server-driven first mint:** Removes fragile ordering between client `fetch` and navigation; **`Set-Cookie`** is always issued from the **`GET` handoff** response before sign-in.
- **Single-use `h` with rotation on duplicate POST:** Preserves recoverability for operators who repeat **`POST` claim-ticket** with the same body while keeping replay semantics explicit (`handoff_used` vs stale **`handoff_invalid`** after rotation).
- **Signed pending cookie vs `sessionStorage`:** Magic-link sign-in must not drop the binding secret; `sessionStorage` does not survive that navigation reliably. The cookie handoff is server-owned and **`httpOnly`**.
- **Single `claim_failed` body on redeem:** Reduces information leakage after authentication.
- **Postgres hourly counters:** Same operational pattern as magic-link sends; `SERIALIZABLE` transactions with bounded retries for contention.
