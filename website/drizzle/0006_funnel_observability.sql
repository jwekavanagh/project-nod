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
	'licensed_verify_outcome'
));
--> statement-breakpoint
CREATE TABLE "verify_outcome_beacon" (
	"api_key_id" text NOT NULL,
	"run_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verify_outcome_beacon_api_key_id_run_id_pk" PRIMARY KEY("api_key_id", "run_id"),
	CONSTRAINT "verify_outcome_beacon_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE cascade ON UPDATE no action
);
