-- L0.5 normative SQLite state for examples/integrate-your-db/bootstrap-input.json (wf_integrate_spine).
-- Apply to an empty or disposable SQLite file before running the integrate spine final ladder.
CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT);
INSERT INTO contacts (id, name, status) VALUES ('c_integrate_spine', 'Alice', 'active');
