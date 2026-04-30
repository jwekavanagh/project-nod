import {
  check,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Auth.js default table name `user`. */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  plan: text("plan").notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** Primary recurring Stripe Price id on the subscription; drives priceMapping on account API. */
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  /** Mint time for SP-R1b episode join; backfilled in migration for legacy rows. */
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

/** Magic-link send rate limits: one row per (scope, scope_key). */
export const magicLinkSendCounters = pgTable(
  "magic_link_send_counter",
  {
    scope: text("scope").notNull(),
    scopeKey: text("scope_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.scope, t.scopeKey] }),
  }),
);

export const apiKeys = pgTable("api_key", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** SHA-256 hex of plaintext key for O(1) lookup (not secret). */
  keyLookupSha256: text("key_lookup_sha256").notNull().unique(),
  /** scrypt$…$… of plaintext key. */
  keyHash: text("key_hash").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
});

export const apiKeyStatusEnum = pgEnum("api_key_v2_status", [
  "active",
  "revoked",
  "disabled",
]);

export const apiKeyScopeEnum = pgEnum("api_key_v2_scope", [
  "read",
  "meter",
  "report",
  "admin",
]);

/**
 * Production key model (v2): multiple concurrent keys, explicit scopes, and lifecycle metadata.
 * Legacy `api_key` stays readable during migration and is removed after hard sunset.
 */
export const apiKeysV2 = pgTable(
  "api_key_v2",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 64 }).notNull(),
    scopes: apiKeyScopeEnum("scopes").array().notNull(),
    keyLookupSha256: text("key_lookup_sha256").notNull().unique(),
    keyHash: text("key_hash").notNull(),
    status: apiKeyStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    disabledAt: timestamp("disabled_at", { mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    rotatedFromKeyId: text("rotated_from_key_id"),
    rotatedToKeyId: text("rotated_to_key_id"),
    migratedFromLegacyId: text("migrated_from_legacy_id").unique(),
  },
  (t) => ({
    labelTrimmedNonEmpty: check(
      "api_key_v2_label_trimmed_nonempty",
      sql`char_length(btrim(${t.label})) between 1 and 64`,
    ),
    scopesNonEmpty: check(
      "api_key_v2_scopes_nonempty",
      sql`coalesce(array_length(${t.scopes}, 1), 0) >= 1`,
    ),
    scopesLenMax4: check(
      "api_key_v2_scopes_len_max4",
      sql`coalesce(array_length(${t.scopes}, 1), 0) <= 4`,
    ),
  }),
);

export const usageCounters = pgTable(
  "usage_counter",
  {
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.apiKeyId, t.yearMonth] }),
  }),
);

export const usageReservations = pgTable(
  "usage_reservation",
  {
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    u: unique().on(t.apiKeyId, t.runId),
  }),
);

/** Immutable evidence blob per governance write. */
export const governanceEvidence = pgTable("governance_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull(),
  runId: text("run_id").notNull(),
  certificateJson: jsonb("certificate_json").notNull(),
  certificateSha256: text("certificate_sha256").notNull(),
  materialTruthJson: jsonb("material_truth_json").notNull(),
  materialTruthSha256: text("material_truth_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Stateful CI enforcement baseline per (user, workflow). */
export const enforcementBaselines = pgTable(
  "enforcement_baseline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id").notNull(),
    projectionHash: text("projection_hash").notNull(),
    projection: jsonb("projection").notNull(),
    baselineEvidenceId: uuid("baseline_evidence_id").references(() => governanceEvidence.id, { onDelete: "set null" }),
    needsRebaseline: boolean("needs_rebaseline").notNull().default(false),
    acceptedByKeyId: text("accepted_by_key_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    userWorkflowUnique: unique().on(t.userId, t.workflowId),
  }),
);

/** Immutable event log for stateful enforcement transitions. */
export const enforcementEvents = pgTable("enforcement_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull(),
  runId: text("run_id").notNull(),
  event: text("event").notNull(),
  expectedProjectionHash: text("expected_projection_hash"),
  actualProjectionHash: text("actual_projection_hash").notNull(),
  evidenceId: uuid("evidence_id").references(() => governanceEvidence.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const enforcementLifecycleStateEnum = pgEnum("enforcement_lifecycle_state", [
  "baseline_missing",
  "baseline_active",
  "action_required",
  "rerun_required",
]);

export const enforcementDecisionVerdictEnum = pgEnum("enforcement_decision_verdict", [
  "decision_trusted",
  "decision_blocked",
]);

export const enforcementFsmEventKindEnum = pgEnum("enforcement_fsm_event_kind", [
  "check",
  "baseline_create",
  "accept_drift",
]);

/** Authoritative posture per `(user_id, workflow_id)`. */
export const enforcementLifecycle = pgTable(
  "enforcement_lifecycle",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id").notNull(),
    currentState: enforcementLifecycleStateEnum("current_state").notNull().default("baseline_missing"),
    stateVersion: integer("state_version").notNull().default(0),
    pendingAcceptProjectionHash: text("pending_accept_projection_hash"),
    lastTransitionId: uuid("last_transition_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.workflowId] }),
  }),
);

export const enforcementFsmTransition = pgTable("enforcement_transition", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull(),
  runId: text("run_id").notNull(),
  eventKind: enforcementFsmEventKindEnum("event_kind").notNull(),
  fromState: enforcementLifecycleStateEnum("from_state").notNull(),
  toState: enforcementLifecycleStateEnum("to_state").notNull(),
  lifecycleStateVersionAfter: integer("lifecycle_state_version_after").notNull(),
  expectedProjectionHash: text("expected_projection_hash"),
  actualProjectionHash: text("actual_projection_hash").notNull(),
  evidenceId: uuid("evidence_id").references(() => governanceEvidence.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Immutable verification attempt verdict (POST /check, POST /baselines only). */
export const enforcementDecision = pgTable("enforcement_decision", {
  attemptId: uuid("attempt_id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull(),
  runId: text("run_id").notNull(),
  decisionState: enforcementDecisionVerdictEnum("decision_state").notNull(),
  decisionReasonCode: text("decision_reason_code").notNull(),
  lifecycleStateBefore: enforcementLifecycleStateEnum("lifecycle_state_before").notNull(),
  lifecycleStateAfter: enforcementLifecycleStateEnum("lifecycle_state_after").notNull(),
  materialTruthSha256: text("material_truth_sha256").notNull(),
  certificateSha256: text("certificate_sha256").notNull(),
  evidenceId: uuid("evidence_id").references(() => governanceEvidence.id, { onDelete: "set null" }),
  httpStatus: smallint("http_status").notNull(),
  recommendedAction: text("recommended_action"),
  automationSafe: boolean("automation_safe"),
  classificationCode: text("classification_code"),
  trustBlockFingerprintSha256: text("trust_block_fingerprint_sha256"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const stripeEvents = pgTable("stripe_event", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
});

export const funnelEvents = pgTable("funnel_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  installId: text("install_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  serverVercelEnv: text("server_vercel_env").notNull().default("unset"),
  serverNodeEnv: text("server_node_env").notNull().default("unset"),
});

/** Idempotent receipt for POST /api/v1/funnel/verify-outcome (one row per api_key + run_id). */
export const verifyOutcomeBeacons = pgTable(
  "verify_outcome_beacon",
  {
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.apiKeyId, t.runId] }),
  }),
);

/** OSS claim bridge: one row per claim_secret hash; authoritative UX after redeem. */
export const ossClaimTickets = pgTable("oss_claim_ticket", {
  secretHash: text("secret_hash").notNull(),
  runId: text("run_id").notNull(),
  terminalStatus: text("terminal_status").notNull(),
  workloadClass: text("workload_class").notNull(),
  subcommand: text("subcommand").notNull(),
  buildProfile: text("build_profile").notNull(),
  issuedAt: text("issued_at").notNull(),
  /** `local_dev` | `unknown` (v2 wire) | `legacy_unattributed` (v1 server). */
  telemetrySource: text("telemetry_source"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  /** Opaque token for `GET /verify/link?h=…` (legacy `claim-handoff` 308s here); unique when set (partial unique index in migration). */
  handoffToken: text("handoff_token"),
  /** First successful GET handoff mint time for the **current** `handoff_token`; null after rotation. */
  handoffConsumedAt: timestamp("handoff_consumed_at", { withTimezone: true, mode: "date" }),
  /** Client-asserted at mint: TTY interactive CLI (see docs/eval-to-revenue-journey.md). */
  interactiveHumanClaim: boolean("interactive_human_claim").notNull().default(false),
  /** Set once when CLI POSTs `claim-continuation` after successful browser spawn. */
  browserOpenInvokedAt: timestamp("browser_open_invoked_at", { withTimezone: true, mode: "date" }),
  /** Stable `x-request-id` for this ticket; echoed on claim-redeem without browser threading. */
  activationRequestId: text("activation_request_id").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.secretHash] }),
}));

/** Hourly rate limits for OSS claim-ticket (per IP) and claim-redeem (per user). */
export const ossClaimRateLimitCounters = pgTable(
  "oss_claim_rate_limit_counter",
  {
    scope: text("scope").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
    scopeKey: text("scope_key").notNull(),
    count: integer("count").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.scope, t.windowStart, t.scopeKey] }),
  }),
);

/** Persisted public verification report (POST /api/public/verification-reports). */
export const sharedVerificationReports = pgTable("shared_verification_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  reportWorkflowId: varchar("report_workflow_id", { length: 512 }).notNull(),
  reportStatusToken: text("report_status_token").notNull(),
  humanText: text("human_text").notNull(),
});

/** Idempotent receipt for POST /api/v1/funnel/trust-decision-blocked. */
export const trustDecisionReceipts = pgTable(
  "trust_decision_receipt",
  {
    apiKeyId: text("api_key_id").notNull(),
    fingerprintSha256: text("fingerprint_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.apiKeyId, t.fingerprintSha256] }),
  }),
);

export const trustAlertCheckpoint = pgTable("trust_alert_checkpoint", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lastDigestSentAt: timestamp("last_digest_sent_at", { withTimezone: true, mode: "date" }),
});

export const trustAlertDelivery = pgTable("trust_alert_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  resendEmailId: text("resend_email_id").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true, mode: "date" }).notNull(),
});
