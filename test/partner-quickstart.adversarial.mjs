/**
 * Adversarial partner quickstart: schema-only DB → ROW_ABSENT → inconsistent → exit 1.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const partnerDir = path.join(root, "examples", "partner-quickstart");
const cliPath = path.join(root, "dist", "cli.js");
const schemaOnlyPath = path.join(partnerDir, "partner.schema-only.sql");
const eventsPath = path.join(partnerDir, "partner.events.ndjson");
const registryPath = path.join(partnerDir, "partner.tools.json");

describe("partner-quickstart adversarial (schema-only sqlite)", () => {
  it("exits 1 with inconsistent / missing / ROW_ABSENT", () => {
    if (!existsSync(cliPath)) {
      assert.fail("dist/cli.js missing; run npm run build first");
    }
    const schemaSql = readFileSync(schemaOnlyPath, "utf8");
    const dbFile = path.join(tmpdir(), `wf-partner-adv-${randomUUID()}.db`);
    const db = new DatabaseSync(dbFile);
    try {
      db.exec(schemaSql);
    } finally {
      db.close();
    }
    const r = spawnSync(
      process.execPath,
      [
        cliPath,
        "--workflow-id",
        "wf_partner",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--db",
        dbFile,
      ],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(r.status, 1, `expected exit 1, got ${r.status}; stderr=${r.stderr}`);
    const obj = JSON.parse((r.stdout ?? "").trim());
    const isCert =
      typeof obj.schemaVersion === "number" &&
      obj.schemaVersion >= 1 &&
      obj.schemaVersion <= 2 &&
      typeof obj.stateRelation === "string" &&
      Object.prototype.hasOwnProperty.call(obj, "humanReport");
    if (isCert) {
      assert.equal(obj.stateRelation, "does_not_match");
      const step0 = obj.steps?.[0];
      assert.ok(step0, "expected at least one certificate step");
      const details = obj.explanation?.details;
      assert.ok(
        Array.isArray(details) && details.some((x) => x && x.code === "ROW_ABSENT"),
        "expected ROW_ABSENT in certificate explanation.details",
      );
    } else {
      assert.equal(obj.status, "inconsistent");
      const step0 = obj.steps?.[0];
      assert.ok(step0);
      assert.equal(step0.status, "missing");
      assert.ok(
        Array.isArray(step0.reasons) && step0.reasons.some((x) => x.code === "ROW_ABSENT"),
        "expected ROW_ABSENT in reasons",
      );
    }
  });
});
