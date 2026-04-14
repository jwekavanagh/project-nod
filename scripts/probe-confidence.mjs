import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runQuickVerify } from "../dist/quickVerify/runQuickVerify.js";

const sql = `
CREATE TABLE aaa (id TEXT PRIMARY KEY);
CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT);
INSERT INTO contacts VALUES ('c_ok','Alice','active');
`;

const tmp = mkdtempSync(join(tmpdir(), "probe-"));
const db = join(tmp, "p.sqlite");
const dbh = new DatabaseSync(db);
dbh.exec(sql);
dbh.close();

const line = JSON.stringify({
  toolId: "aa.save",
  params: { "contacts.idid": "c_ok", "contacts.name": "Alice", "contacts.status": "active" },
}) + "\n";
const { report } = await runQuickVerify({ inputUtf8: line, sqlitePath: db });
const row = report.units.find((u) => u.kind === "row");
console.log(row?.verdict, row?.confidence, row?.contractEligible, row?.inference?.table);
rmSync(tmp, { recursive: true });
