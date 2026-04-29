CREATE TABLE IF NOT EXISTS governance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  run_id text NOT NULL,
  certificate_json jsonb NOT NULL,
  certificate_sha256 text NOT NULL,
  material_truth_json jsonb NOT NULL,
  material_truth_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE enforcement_baseline
  ADD COLUMN IF NOT EXISTS baseline_evidence_id uuid REFERENCES governance_evidence(id) ON DELETE SET NULL;

ALTER TABLE enforcement_baseline
  ADD COLUMN IF NOT EXISTS needs_rebaseline boolean NOT NULL DEFAULT false;

ALTER TABLE enforcement_event
  ADD COLUMN IF NOT EXISTS evidence_id uuid REFERENCES governance_evidence(id) ON DELETE SET NULL;

UPDATE enforcement_baseline
SET needs_rebaseline = true
WHERE baseline_evidence_id IS NULL;
