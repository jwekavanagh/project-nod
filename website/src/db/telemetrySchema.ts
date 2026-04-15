import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Telemetry-store `funnel_event` (no FKs to core). */
export const telemetryFunnelEvents = pgTable("funnel_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(),
  userId: text("user_id"),
  installId: text("install_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  serverVercelEnv: text("server_vercel_env").notNull(),
  serverNodeEnv: text("server_node_env").notNull(),
});

export const telemetryProductActivationStartedBeacons = pgTable(
  "product_activation_started_beacon",
  {
    runId: text("run_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.runId] }),
  }),
);

export const telemetryProductActivationOutcomeBeacons = pgTable(
  "product_activation_outcome_beacon",
  {
    runId: text("run_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.runId] }),
  }),
);
