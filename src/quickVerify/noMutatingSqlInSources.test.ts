import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickVerifySourceViolatesSqlPolicy } from "./forbiddenMutatingSql.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("quickVerify sources SQL policy", () => {
  it("no production quickVerify .ts file contains forbidden DML pattern", () => {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
      const text = readFileSync(path.join(dir, f), "utf8");
      expect(quickVerifySourceViolatesSqlPolicy(text), f).toBe(false);
    }
  });

  describe("quickVerifySourceViolatesSqlPolicy negatives", () => {
    it("flags INSERT INTO", () => {
      expect(quickVerifySourceViolatesSqlPolicy("INSERT INTO t VALUES (1)")).toBe(true);
    });
    it("flags UPDATE ... SET", () => {
      expect(quickVerifySourceViolatesSqlPolicy("UPDATE foo SET x = 1")).toBe(true);
    });
    it("flags DELETE FROM", () => {
      expect(quickVerifySourceViolatesSqlPolicy("DELETE FROM bar")).toBe(true);
    });
    it("flags DROP TABLE", () => {
      expect(quickVerifySourceViolatesSqlPolicy("DROP TABLE baz")).toBe(true);
    });
    it("flags TRUNCATE TABLE", () => {
      expect(quickVerifySourceViolatesSqlPolicy("TRUNCATE TABLE qux")).toBe(true);
    });
  });
});
