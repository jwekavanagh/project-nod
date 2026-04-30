-- Closed-loop enforcement FSM tables (lifecycle posture + transitions + immutable verification attempts)

CREATE TYPE enforcement_lifecycle_state AS ENUM (
  'baseline_missing',
  'baseline_active',
  'action_required',
  'rerun_required'
);

CREATE TYPE enforcement_decision_verdict AS ENUM (
  'decision_trusted',
  'decision_blocked'
);

CREATE TYPE enforcement_fsm_event_kind AS ENUM (
  'check',
  'baseline_create',
  'accept_drift'
);

CREATE TABLE enforcement_lifecycle (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  current_state enforcement_lifecycle_state NOT NULL DEFAULT 'baseline_missing',
  state_version integer NOT NULL DEFAULT 0,
  pending_accept_projection_hash text,
  last_transition_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workflow_id)
);

CREATE INDEX enforcement_lifecycle_user_idx ON enforcement_lifecycle (user_id);

CREATE TABLE enforcement_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  run_id text NOT NULL,
  event_kind enforcement_fsm_event_kind NOT NULL,
  from_state enforcement_lifecycle_state NOT NULL,
  to_state enforcement_lifecycle_state NOT NULL,
  lifecycle_state_version_after integer NOT NULL,
  expected_projection_hash text,
  actual_projection_hash text NOT NULL,
  evidence_id uuid REFERENCES governance_evidence(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enforcement_transition_positive_version CHECK (lifecycle_state_version_after >= 0)
);

CREATE INDEX enforcement_transition_user_workflow_idx ON enforcement_transition (user_id, workflow_id, created_at DESC);

CREATE TABLE enforcement_decision (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  run_id text NOT NULL,
  decision_state enforcement_decision_verdict NOT NULL,
  decision_reason_code text NOT NULL,
  lifecycle_state_before enforcement_lifecycle_state NOT NULL,
  lifecycle_state_after enforcement_lifecycle_state NOT NULL,
  material_truth_sha256 text NOT NULL,
  certificate_sha256 text NOT NULL,
  evidence_id uuid REFERENCES governance_evidence(id) ON DELETE SET NULL,
  http_status smallint NOT NULL CHECK (http_status IN (200, 409)),
  recommended_action text,
  automation_safe boolean,
  classification_code text,
  trust_block_fingerprint_sha256 text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX enforcement_decision_user_workflow_created_idx ON enforcement_decision (user_id, workflow_id, created_at DESC);
