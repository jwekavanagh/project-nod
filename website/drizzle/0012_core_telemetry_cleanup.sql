DELETE FROM "funnel_event"
WHERE "event" IN (
	'demo_verify_ok',
	'acquisition_landed',
	'integrate_landed',
	'verify_started',
	'verify_outcome'
);
--> statement-breakpoint
DROP TABLE IF EXISTS "product_activation_started_beacon" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "product_activation_outcome_beacon" CASCADE;
--> statement-breakpoint
ALTER TABLE "funnel_event" DROP CONSTRAINT "funnel_event_event_check";
--> statement-breakpoint
ALTER TABLE "funnel_event" ADD CONSTRAINT "funnel_event_event_check" CHECK ("event" IN (
	'sign_in',
	'checkout_started',
	'subscription_checkout_completed',
	'api_key_created',
	'reserve_allowed',
	'report_share_created',
	'report_share_view',
	'licensed_verify_outcome',
	'oss_claim_redeemed'
));
