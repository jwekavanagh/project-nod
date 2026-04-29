import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Guards against deploying code that expects `api_key_v2` without shipping the migration SQL. */
describe("api_key_v2 Drizzle migration artifact", () => {
  it("0016 defines CREATE TABLE api_key_v2", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const sqlPath = path.join(root, "drizzle", "0016_api_key_v2.sql");
    const src = readFileSync(sqlPath, "utf8");
    expect(src).toContain('CREATE TABLE "api_key_v2"');
  });
});
