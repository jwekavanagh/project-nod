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
	'report_share_view',
	'acquisition_landed',
	'integrate_landed',
	'licensed_verify_outcome',
	'verify_started',
	'verify_outcome'
));
--> statement-breakpoint
CREATE TABLE "product_activation_started_beacon" (
	"run_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_activation_started_beacon_run_id_pk" PRIMARY KEY("run_id")
);
--> statement-breakpoint
CREATE TABLE "product_activation_outcome_beacon" (
	"run_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_activation_outcome_beacon_run_id_pk" PRIMARY KEY("run_id")
);
