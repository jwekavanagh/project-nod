import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runQuickVerify, quickReportToStdoutLine } from "./runQuickVerify.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dbPath = join(root, "test/fixtures/quick-param-pointer/pointer-promotion.sqlite");

describe("quick param pointer negatives", () => {
  it("preflight-fail stdout golden (value mismatch)", async () => {
    const line =
      JSON.stringify({
        toolId: "aa.save",
        params: { contacts: { idid: "c_ok", name: "Bob", status: "active" } },
      }) + "\n";
    const { report } = await runQuickVerify({ inputUtf8: line, sqlitePath: dbPath });
    const expected = readFileSync(
      join(root, "test/golden/quick-param-pointer/v1/quick.stdout.preflight-fail.jsonline"),
      "utf8",
    );
    expect(quickReportToStdoutLine(report)).toBe(expected);
  });

  it("unmappable stdout golden (no units)", async () => {
    const line = JSON.stringify({ toolId: "zzz", params: {} }) + "\n";
    const { report } = await runQuickVerify({ inputUtf8: line, sqlitePath: dbPath });
    const expected = readFileSync(
      join(root, "test/golden/quick-param-pointer/v1/quick.stdout.unmappable.jsonline"),
      "utf8",
    );
    expect(quickReportToStdoutLine(report)).toBe(expected);
  });
});
