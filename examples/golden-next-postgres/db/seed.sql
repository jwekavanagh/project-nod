DROP TABLE IF EXISTS contacts;

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT
);

INSERT INTO contacts (id, name, status) VALUES ('c_ok', 'Alice', 'active');
