# Commercial HTTP activation (correlation, errors, OpenAPI)

Normative contract for **traceable, machine-readable** HTTP on the OSS → paid activation surface: license reserve, plans catalog, verify-outcome beacon, public verification report ingestion, and OSS claim (ticket, redeem, continuation, legacy handoff redirect).

**OpenAPI:** [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml) (served at `/openapi-commercial-v1.yaml` on the canonical site). **Drift gate:** [`scripts/assert-openapi-covers-activation-routes.mjs`](../scripts/assert-openapi-covers-activation-routes.mjs) — every `website/src/app/api/v1/**/route.ts`, `website/src/app/api/oss/**/route.ts`, and `api/public/verification-reports/route.ts` must appear in that spec (and vice versa).

**Implementation spine:** [`website/src/lib/activationHttp.ts`](../website/src/lib/activationHttp.ts) — `resolveActivationRequestId`, `activationJson`, `activationProblem`, `activationReserveDeny`, `activationNoContent`, `activationRedirect`.

## Engineer

- **Correlation:** Every response sets `x-request-id`. Accept client header when it is a UUID or matches `^[A-Za-z0-9._-]{8,128}$`; otherwise generate a UUID.
- **OSS ticket → redeem:** `oss_claim_ticket.activation_request_id` stores the mint-time id; **claim-redeem** echoes that value on responses so browser clients need not thread the header through redirects.
- **Commercial CLI:** One `x-request-id` per lock/verify run (`newActivationHttpCorrelationId` in [`src/commercial/activationCorrelation.ts`](../src/commercial/activationCorrelation.ts)) is passed to `POST /api/v1/usage/reserve` and `POST /api/v1/funnel/verify-outcome` via [`runLicensePreflightIfNeeded`](../src/commercial/licensePreflight.ts) / [`postVerifyOutcomeBeacon`](../src/commercial/postVerifyOutcomeBeacon.ts). OSS claim-ticket / claim-continuation use the same optional header from [`maybeEmitOssClaimTicketUrlToStderr`](../src/telemetry/maybeEmitOssClaimTicketUrl.ts).
- **Errors:** Non-2xx responses use JSON with RFC 7807-style fields: `type` (absolute URI under `https://agentskeptic.com/problems/...`), `title`, `status`, `detail`, optional `code`, `instance`. **`POST /api/v1/usage/reserve` denials** additionally include legacy fields `allowed: false`, `code`, `message`, optional `upgrade_url` (same keys the CLI already parses).
- **verify-outcome success:** HTTP **204** with an empty body; `x-request-id` is still set.

## Integrator

- Generate clients from the OpenAPI file above; do not rely on undocumented routes — CI fails if routes and spec diverge.
- Send `x-request-id` on reserve and verify-outcome if you want log correlation across both calls; omitting it is fine (server generates).
- OSS **claim-ticket** requires product activation CLI headers (see `website/src/lib/funnelProductActivationConstants.ts`).

## Operator

- Search logs and support tickets by **`x-request-id`** from CLI stderr, browser UI (claim error states), or API responses.
- Reserve denial messages from the CLI include `[x-request-id=…]` when the license server returned a header.

## Problem `type` URI patterns

Concrete paths are under `https://agentskeptic.com/problems/` with kebab-case suffixes (e.g. `bad-request`, `rate-limited`, `reserve-quota-exceeded`). Reserve denials use `reserve-<code>` with underscores in `code` mapped to hyphens in the URI segment.
