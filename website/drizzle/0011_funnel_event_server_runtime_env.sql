ALTER TABLE "funnel_event" ADD COLUMN "server_vercel_env" text DEFAULT 'unset' NOT NULL;
--> statement-breakpoint
ALTER TABLE "funnel_event" ADD COLUMN "server_node_env" text DEFAULT 'unset' NOT NULL;
