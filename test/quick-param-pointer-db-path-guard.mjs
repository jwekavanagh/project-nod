import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertQuickParamPointerDbPaths } from "./quick-param-pointer-db-path-guard.lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("quick-param-pointer DB path guard", () => {
  it("guards four Vitest files", () => {
    assertQuickParamPointerDbPaths(root);
  });
});
