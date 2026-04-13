PRAGMA foreign_keys = ON;
CREATE TABLE px (id TEXT PRIMARY KEY);
CREATE TABLE qv_child (
  child_row_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES px (id)
);
INSERT INTO px (id) VALUES ('p1');
INSERT INTO qv_child (child_row_id, parent_id) VALUES ('c1', 'p1');
