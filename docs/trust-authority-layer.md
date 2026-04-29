# Trust authority layer (hosted + SDK)

Normative **`TrustDecisionRecordV1`** JSON Schema: [`schemas/trust-decision-record-v1.schema.json`](../schemas/trust-decision-record-v1.schema.json).

## Integrators (npm / Node)

### Runtime ingestion

Blocking an irreversible action calls **`finalizeIrreversibleBlockThrow`** upstream of **`TrustDecisionBlockedError`**. It posts a deterministic record to **`POST /api/v1/funnel/trust-decision-blocked`** when **`LICENSE_API_BASE_URL`** is configured **and** **`AGENTSKEPTIC_API_KEY`** (or **`WORKFLOW_VERIFIER_API_KEY`**) exists. **`LICENSE_PREFLIGHT_ENABLED` is intentionally not consulted** for this path.

### Throws

Prefer catching **`TrustDecisionBlockedError`**. Inspect **`error.record`** (**`human_blocker_lines`**) for UI; inspect **`certificate_snapshot`** for analytics.

## Operators (hosted)

- **`funnel_event.event = trust_decision_blocked`** stores payloads for account Trust posture (**Account → Trust posture**).
- Threshold digest email uses **Resend** (`RESEND_API_KEY`) from **`GET`/`POST` `/api/internal/trust-alerts`** (**`Authorization: Bearer ${CRON_SECRET}`**) on schedule **`5 0 * * *`**.
- Append-only proof rows: **`trust_alert_delivery`** (**`resend_email_id`**), cadence in **`trust_alert_checkpoint`**.

## Reviewers

- OpenAPI: [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml) — **`postTrustDecisionBlocked`**.

## Python

Python mirrors **`TrustDecisionBlockedError`** for local catch-parity **without** outbound HTTPS ingestion in this milestone (SDK hosted capture is Node-only).
