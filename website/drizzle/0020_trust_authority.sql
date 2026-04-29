CREATE TABLE "trust_decision_receipt" (
  "api_key_id" text NOT NULL,
  "fingerprint_sha256" char(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("api_key_id", "fingerprint_sha256")
);

CREATE TABLE "trust_alert_checkpoint" (
  "user_id" text NOT NULL PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "last_digest_sent_at" timestamptz
);

CREATE TABLE "trust_alert_delivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "sent_at" timestamptz NOT NULL DEFAULT now(),
  "resend_email_id" text NOT NULL,
  "window_start" timestamptz NOT NULL,
  "window_end" timestamptz NOT NULL
);

CREATE INDEX "trust_alert_delivery_user_id_sent_at_idx" ON "trust_alert_delivery" ("user_id", "sent_at" DESC);
