CREATE TABLE "magic_link_send_counter" (
	"scope" text NOT NULL,
	"scope_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "magic_link_send_counter_scope_scope_key_pk" PRIMARY KEY("scope","scope_key")
);
