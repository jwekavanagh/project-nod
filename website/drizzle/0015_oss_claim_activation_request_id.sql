-- Mint-time correlation ID for activation HTTP (x-request-id echo on claim-redeem).
ALTER TABLE "oss_claim_ticket" ADD COLUMN "activation_request_id" text;
--> statement-breakpoint
UPDATE "oss_claim_ticket" SET "activation_request_id" = gen_random_uuid()::text WHERE "activation_request_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "oss_claim_ticket" ALTER COLUMN "activation_request_id" SET NOT NULL;
