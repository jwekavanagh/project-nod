/**
 * After the server-driven GET handoff cutover, legacy fragment URLs and the
 * browser-only stash route must not reappear under website/src or src.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FORBIDDEN_SUBSTRINGS = ["/claim#", "claim-pending"];

function* walkSourceFiles(dir) {
  const names = readdirSync(dir);
  for (const name of names) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      yield* walkSourceFiles(p);
    } else if (/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(name)) {
      yield p;
    }
  }
}

describe("OSS legacy handoff ban (no fragment URL, no stash route references)", () => {
  it("website/src and src contain no forbidden substrings", () => {
    const dirs = [join(root, "website", "src"), join(root, "src")];
    for (const base of dirs) {
      for (const file of walkSourceFiles(base)) {
        const text = readFileSync(file, "utf8");
        for (const s of FORBIDDEN_SUBSTRINGS) {
          assert.ok(
            !text.includes(s),
            `Forbidden substring ${JSON.stringify(s)} in ${file.replace(root + "\\", "").replace(root + "/", "")}`,
          );
        }
      }
    }
  });
});
