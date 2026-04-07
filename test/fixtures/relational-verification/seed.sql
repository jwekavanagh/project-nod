DROP TABLE IF EXISTS rel_lines;
DROP TABLE IF EXISTS rel_orders;
DROP TABLE IF EXISTS rel_b;
DROP TABLE IF EXISTS rel_a;

CREATE TABLE rel_orders (id TEXT PRIMARY KEY);
INSERT INTO rel_orders VALUES ('o1');

CREATE TABLE rel_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku TEXT NOT NULL
);
INSERT INTO rel_lines VALUES ('l1', 'o1', 'sku_a'), ('l2', 'o1', 'sku_b');

CREATE TABLE rel_a (id TEXT PRIMARY KEY);
CREATE TABLE rel_b (id TEXT PRIMARY KEY, a_id TEXT);
INSERT INTO rel_a VALUES ('a1');
INSERT INTO rel_b VALUES ('b1', 'a_other');
