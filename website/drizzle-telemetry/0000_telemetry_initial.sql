CREATE TABLE "funnel_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"user_id" text,
	"install_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_vercel_env" text NOT NULL,
	"server_node_env" text NOT NULL
);
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
