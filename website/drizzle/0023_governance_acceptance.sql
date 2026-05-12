CREATE TABLE governance_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  run_id text NOT NULL,
  evidence_id uuid NOT NULL REFERENCES governance_evidence(id) ON DELETE RESTRICT,
  acceptance_reason text NOT NULL,
  acceptance_owner text NOT NULL,
  evidence_links jsonb,
  exception_review_by timestamp with time zone,
  accepted_material_truth_sha256 text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX governance_acceptance_user_workflow_created_idx ON governance_acceptance (user_id, workflow_id, created_at DESC);

ALTER TABLE enforcement_baseline ADD COLUMN active_acceptance_id uuid REFERENCES governance_acceptance(id) ON DELETE SET NULL;
