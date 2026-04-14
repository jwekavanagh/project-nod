import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSyntheticRowParams, stableStringifySyntheticParams } from "./buildSyntheticRowParams.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("buildSyntheticRowParams", () => {
  it("matches golden merge bytes", () => {
    const golden = readFileSync(
      join(root, "test/golden/quick-param-pointer/v1/synthetic-params-merge.txt"),
      "utf8",
    ).trim();
    const merged = buildSyntheticRowParams(
      { contacts: { idid: "c_ok", name: "Alice", status: "active" } },
      { name: "Alice", status: "active" },
    );
    expect(stableStringifySyntheticParams(merged)).toBe(golden);
  });

  it("throws on circular actionParams", () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(() => buildSyntheticRowParams(o, {})).toThrow();
  });
});
