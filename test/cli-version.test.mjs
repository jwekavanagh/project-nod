/**
 * T4: dist/cli.js --version matches root package.json (after build in test:ci).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("cli --version", () => {
  it("prints root package.json version (T4)", () => {
    const distCli = join(root, "dist", "cli.js");
    assert.ok(
      existsSync(distCli),
      "dist/cli.js missing: run `npm run build` before this test (CI test:ci runs build first).",
    );
    const want = String(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).trim();
    const out = execFileSync(
      process.execPath,
      [distCli, "--version"],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(String(out).trim(), want);
  });
});
