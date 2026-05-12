-- Dev/stage only: drop governed acceptance column and table (not a production rollback path).
ALTER TABLE enforcement_baseline DROP COLUMN IF EXISTS active_acceptance_id;
DROP TABLE IF EXISTS governance_acceptance;
