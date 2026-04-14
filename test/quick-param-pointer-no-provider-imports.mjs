import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoProviderImportsInQuickVerify } from "./quick-param-pointer-no-provider-imports.lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("quick-param-pointer no provider imports", () => {
  it("scans src/quickVerify with frozen regexes", () => {
    assertNoProviderImportsInQuickVerify(root);
  });
});
