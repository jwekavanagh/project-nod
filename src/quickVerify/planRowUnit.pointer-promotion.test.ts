import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { SqliteSchemaCatalog } from "./sqliteCatalog.js";
import { planRowUnit } from "./rowUnit.js";
import { bucketsForAction } from "./decomposeUnits.js";
import { flattenParams } from "./ingest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dbPath = join(root, "test/fixtures/quick-param-pointer/pointer-promotion.sqlite");

describe("planRowUnit pointer promotion fixture", () => {
  it("emits pk bindings and pointerComplete", async () => {
    const golden = JSON.parse(
      readFileSync(join(root, "test/golden/quick-param-pointer/v1/plan-row-bindings.json"), "utf8"),
    );
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const catalog = new SqliteSchemaCatalog(db);
    const tables = await catalog.listTables();
    const params = { contacts: { idid: "c_ok", name: "Alice", status: "active" } };
    const { flat } = flattenParams(params);
    const bs = bucketsForAction("aa.save", flat, tables);
    const plan = await planRowUnit(catalog, bs[0]!, tables);
    db.close();
    expect(plan.request).not.toBeNull();
    expect(plan.pointerComplete).toBe(true);
    expect(plan.pkFlatBindings).toEqual(golden);
    expect(plan.confidence).toBeGreaterThanOrEqual(0.5);
    expect(plan.confidence).toBeLessThan(0.55);
  });
});
