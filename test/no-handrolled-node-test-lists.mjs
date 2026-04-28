/**
 * Fail if any root package.json script value embeds a `test/…/*.mjs` path.
 * Hand-rolled lists are forbidden; use test/suites.mjs + scripts/verification-truth*.mjs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const handRolledTestMjs = /test\/[A-Za-z0-9_.-]+\.mjs/g;

describe("no hand-rolled test/*.mjs in package.json scripts", () => {
  it("scripts must not reference test/*.mjs (use test/suites.mjs and verification-truth orchestration)", () => {
    for (const [name, v] of Object.entries(pkg.scripts)) {
      if (typeof v !== "string") continue;
      const matches = v.match(handRolledTestMjs);
      if (matches?.length) {
        const uniq = [...new Set(matches)].sort().join(", ");
        assert.fail(
          `Hand-rolled test path in scripts.${name}: ${uniq}. ` +
            `Use test/suites.mjs and verification-truth tooling; registry is test/suites.mjs`,
        );
      }
    }
  });
});
