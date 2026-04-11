CREATE TABLE "shared_verification_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"report_workflow_id" varchar(512) NOT NULL,
	"report_status_token" text NOT NULL,
	"human_text" text NOT NULL,
	CONSTRAINT "shared_verification_report_kind_check" CHECK ("kind" IN ('workflow', 'quick'))
);
--> statement-breakpoint
ALTER TABLE "funnel_event" DROP CONSTRAINT "funnel_event_event_check";
--> statement-breakpoint
ALTER TABLE "funnel_event" ADD CONSTRAINT "funnel_event_event_check" CHECK ("event" IN (
	'demo_verify_ok',
	'sign_in',
	'checkout_started',
	'subscription_checkout_completed',
	'api_key_created',
	'reserve_allowed',
	'report_share_created',
	'report_share_view'
));
