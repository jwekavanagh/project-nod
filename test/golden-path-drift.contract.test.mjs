import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("golden path drift contract", () => {
  it("keeps canonical stack language aligned across docs and integrate page", () => {
    const integrateDoc = readFileSync(join(root, "docs", "integrate.md"), "utf8");
    const integratePage = readFileSync(join(root, "website", "src", "app", "integrate", "page.tsx"), "utf8");
    assert.equal(integrateDoc.includes("Next.js (App Router) + Postgres"), true);
    assert.equal(integrateDoc.includes("Start here (canonical):"), true);
    assert.equal(integrateDoc.includes("Optional accelerator"), true);
    assert.equal(integratePage.includes("Next.js + Postgres"), true);
    assert.equal(integrateDoc.includes("SQLite only on day one"), false);
    assert.equal(integratePage.includes("SQLite only on day one"), false);
  });

  it("keeps executable golden-path command and reference paths in sync", () => {
    const goldenPathDoc = readFileSync(join(root, "docs", "golden-path.md"), "utf8");
    assert.equal(goldenPathDoc.includes("npm run golden:path"), true);
    assert.equal(goldenPathDoc.includes("examples/golden-next-postgres"), true);
    assert.equal(existsSync(join(root, "examples", "golden-next-postgres", "scripts", "run-reference.mjs")), true);
    assert.equal(existsSync(join(root, "examples", "golden-next-postgres", "app", "api", "verify", "route.ts")), true);
  });
});
