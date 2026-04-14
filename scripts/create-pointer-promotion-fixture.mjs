import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "test", "fixtures", "quick-param-pointer");
mkdirSync(dir, { recursive: true });
const p = join(dir, "pointer-promotion.sqlite");
const db = new DatabaseSync(p);
db.exec(`
DROP TABLE IF EXISTS aaa;
DROP TABLE IF EXISTS contacts;
CREATE TABLE aaa (id TEXT PRIMARY KEY);
CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT);
INSERT INTO contacts VALUES ('c_ok','Alice','active');
`);
db.close();
console.log("wrote", p);
