/**
 * Root package.json description must match discovery acquisition pageMetadata (sync SSOT).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("package.json description matches primary marketing pageMetadata.description", () => {
  const pm = JSON.parse(readFileSync(join(root, "config", "primary-marketing.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.description, pm.pageMetadata.description);
  assert.notEqual(
    pkg.description,
    pm.identityOneLiner,
    "npm description must not fall back to identityOneLiner",
  );
});
