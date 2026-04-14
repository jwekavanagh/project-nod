import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RE1 = /^\s*import\s+[^;]*\sfrom\s+["'](openai|@ai-sdk\/|@anthropic\/|anthropic)["']/m;
const RE2 = /^\s*import\s*["'](openai|@ai-sdk\/|@anthropic\/|anthropic)["']/m;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) out.push(p);
  }
}

export function assertNoProviderImportsInQuickVerify(root) {
  const base = join(root, "src", "quickVerify");
  const files = [];
  walk(base, files);
  assert.ok(files.length > 0);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    let i = 0;
    for (const line of lines) {
      i++;
      assert.equal(RE1.test(line), false, `${file}:${i} matched RE1`);
      assert.equal(RE2.test(line), false, `${file}:${i} matched RE2`);
    }
  }
}
