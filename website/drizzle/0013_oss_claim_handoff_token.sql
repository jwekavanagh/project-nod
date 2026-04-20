ALTER TABLE "oss_claim_ticket" ADD COLUMN IF NOT EXISTS "handoff_token" text;
ALTER TABLE "oss_claim_ticket" ADD COLUMN IF NOT EXISTS "handoff_consumed_at" timestamp with time zone;
CREATE UNIQUE INDEX IF NOT EXISTS "oss_claim_ticket_handoff_token_uidx" ON "oss_claim_ticket" ("handoff_token") WHERE handoff_token IS NOT NULL;
