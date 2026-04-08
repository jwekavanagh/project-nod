/**
 * Banned script name substrings must not appear under product tree roots.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const BANNED = ["quick-verify-contract", "quick-verify-sql-allowlist"];
const EXT = new Set([".md", ".json", ".mjs", ".js", ".ts", ".yml", ".yaml", ".cjs"]);

const FILES_AT_ROOT = ["README.md", "package.json"];

function walkFiles(absDir, out) {
  for (const ent of readdirSync(absDir, { withFileTypes: true })) {
    const p = join(absDir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist", ".git", ".cursor"].includes(ent.name)) continue;
      walkFiles(p, out);
    } else if (ent.isFile()) {
      const ext = ent.name.slice(ent.name.lastIndexOf("."));
      if (EXT.has(ext)) out.push(p);
    }
  }
}

describe("removed script names ban", () => {
  it("no banned substrings under allowlisted roots", () => {
    const selfName = "removed-script-names-ban.test.mjs";
    const files = [];

    for (const rel of ["docs", "src", "scripts", "test", "examples", ".github"]) {
      const d = join(root, rel);
      try {
        statSync(d);
        walkFiles(d, files);
      } catch {
        /* */
      }
    }
    for (const f of FILES_AT_ROOT) {
      const p = join(root, f);
      try {
        if (statSync(p).isFile()) files.push(p);
      } catch {
        /* */
      }
    }

    const hits = [];
    const skipBasenames = new Set([selfName, "npm-scripts-contract.test.mjs"]);
    for (const abs of files) {
      if (skipBasenames.has(basename(abs))) continue;
      let text;
      try {
        text = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      for (const b of BANNED) {
        if (text.includes(b)) hits.push({ file: abs.replace(root + "\\", "").replace(root + "/", ""), b });
      }
    }

    assert.deepEqual(
      hits,
      [],
      hits.length ? `Banned substring(s) found: ${JSON.stringify(hits, null, 2)}` : "",
    );
  });
});
