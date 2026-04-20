-- Mint-time interactive human flag + CLI spawn ack (eval-to-account program).
ALTER TABLE "oss_claim_ticket" ADD COLUMN "interactive_human_claim" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "oss_claim_ticket" ADD COLUMN "browser_open_invoked_at" timestamp with time zone;
--> statement-breakpoint
-- Session episode join for SP-R1b: backfill then NOT NULL + default for adapter inserts.
ALTER TABLE "session" ADD COLUMN "created_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "session" SET "created_at" = ("expires" - interval '30 days') WHERE "created_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DEFAULT now();
