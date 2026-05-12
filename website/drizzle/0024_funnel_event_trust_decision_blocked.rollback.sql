-- Dev/stage only: restore prior funnel_event check (drops trust_decision_blocked rows first if present).
DELETE FROM "funnel_event" WHERE "event" = 'trust_decision_blocked';
ALTER TABLE "funnel_event" DROP CONSTRAINT "funnel_event_event_check";
ALTER TABLE "funnel_event" ADD CONSTRAINT "funnel_event_event_check" CHECK ("event" IN (
	'sign_in',
	'checkout_started',
	'subscription_checkout_completed',
	'api_key_created',
	'api_key_revoked',
	'api_key_rotated',
	'api_key_scope_denied',
	'api_key_last_used_write_failed',
	'reserve_allowed',
	'report_share_created',
	'report_share_view',
	'licensed_verify_outcome',
	'oss_claim_redeemed'
));
