import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runQuickVerify, quickReportToStdoutLine } from "./runQuickVerify.js";
import { buildQuickContractEventsNdjson } from "./buildQuickContractEventsNdjson.js";
import { stableStringify } from "./canonicalJson.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dbPath = join(root, "test/fixtures/quick-param-pointer/pointer-promotion.sqlite");
const promoLine =
  JSON.stringify({
    toolId: "aa.save",
    params: { contacts: { idid: "c_ok", name: "Alice", status: "active" } },
  }) + "\n";

describe("quick param pointer promotion goldens", () => {
  it("matches export registry, NDJSON, stdout, and inferability slice", async () => {
    const { report, contractExports, registryUtf8 } = await runQuickVerify({
      inputUtf8: promoLine,
      sqlitePath: dbPath,
    });
    const row = report.units.find((u) => u.kind === "row");
    expect(row?.contractEligible).toBe(true);
    expect(readFileSync(join(root, "test/golden/quick-param-pointer/v1/export.tools.json"), "utf8")).toBe(
      registryUtf8,
    );
    const events = buildQuickContractEventsNdjson({ workflowId: "quick-verify", exports: contractExports });
    expect(readFileSync(join(root, "test/golden/quick-param-pointer/v1/contract.events.ndjson"), "utf8")).toBe(
      events,
    );
    expect(readFileSync(join(root, "test/golden/quick-param-pointer/v1/quick.stdout.promoted.jsonline"), "utf8")).toBe(
      quickReportToStdoutLine(report),
    );
    const slice = {
      confidence: row?.confidence,
      reasonCodes: row?.reasonCodes,
      inference: row?.inference,
    };
    expect(readFileSync(join(root, "test/golden/quick-param-pointer/v1/expected.unit-row-slice.json"), "utf8")).toBe(
      stableStringify(slice) + "\n",
    );
  });
});
