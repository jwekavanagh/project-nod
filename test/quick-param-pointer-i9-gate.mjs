/**
 * I9: Vitest negatives, then DB path guard, then no-provider-imports (single node:test entrypoint).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertQuickParamPointerDbPaths } from "./quick-param-pointer-db-path-guard.lib.mjs";
import { assertNoProviderImportsInQuickVerify } from "./quick-param-pointer-no-provider-imports.lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("quick-param-pointer i9 gate", () => {
  it("runs negatives, db-path guard, no-provider guard", () => {
    const v = spawnSync("npm run test:vitest -- src/quickVerify/quickParamPointerNegatives.test.ts", {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    assert.strictEqual(v.status, 0);
    assertQuickParamPointerDbPaths(root);
    assertNoProviderImportsInQuickVerify(root);
  });
});
