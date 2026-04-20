/**
 * Product requirement: README adoption block precedes wedge and anchors; no clone-first
 * commands above ## Advanced; golden-path and first-run point at README correctly.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

export const WEDGE_HEADING_LINE = "## Buy vs build: why not only SQL checks";
export const WEDGE_FRAGMENT = "buy-vs-build-why-not-only-sql-checks";
export const README_WEDGE_LINK = `../README.md#${WEDGE_FRAGMENT}`;
export const README_DEFAULT_PATH_LINK = "../README.md#default-path-verify-from-your-app";

/** Minimum concepts: drift, ownership, shared contract/registry, CI or audit gates */
const ANTI_SCRIPT_TOKENS = [/drift/i, /ownership/i, /registry/i, /\bCI\b|audit/i];

describe("readme adoption + wedge", () => {
  it("O1 README: adoption block before wedge, anchors, and Advanced", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const iAdopt = readme.indexOf("<!-- adoption-canonical:start -->");
    const iWedge = readme.indexOf(WEDGE_HEADING_LINE);
    const iAnchors = readme.indexOf("<!-- public-product-anchors:start -->");
    const iAdv = readme.indexOf("## Advanced");
    assert.ok(iAdopt >= 0, "adoption markers missing");
    assert.ok(iWedge >= 0, "wedge heading missing");
    assert.ok(iAnchors >= 0, "public-product-anchors missing");
    assert.ok(iAdv >= 0, "## Advanced missing");
    assert.ok(iAdopt < iWedge, "adoption must precede wedge");
    assert.ok(iWedge < iAnchors, "wedge must precede public anchors");
    assert.ok(iAnchors < iAdv, "public anchors must precede Advanced");
  });

  it("O2 README: anti-script concept bundle in wedge body", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const start = readme.indexOf(WEDGE_HEADING_LINE);
    assert.ok(start >= 0, "wedge section missing");
    const end = readme.indexOf("**Core mechanism:**", start);
    assert.ok(end >= 0, "core mechanism after wedge missing");
    const wedgeBody = readme.slice(start, end);
    for (const re of ANTI_SCRIPT_TOKENS) {
      assert.match(wedgeBody, re, `wedge body must match ${re}`);
    }
  });

  it("O3 README: adoption region contains verifyAgentskeptic import", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const a0 = readme.indexOf("<!-- adoption-canonical:start -->");
    const a1 = readme.indexOf("<!-- adoption-canonical:end -->");
    assert.ok(a0 >= 0 && a1 > a0, "adoption markers missing");
    const region = readme.slice(a0, a1);
    assert.match(region, /import \{ verifyAgentskeptic \} from "agentskeptic"/);
  });

  it("O4 README: no npm start above ## Advanced", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const iAdv = readme.indexOf("## Advanced");
    assert.ok(iAdv >= 0, "## Advanced missing");
    const before = readme.slice(0, iAdv);
    assert.equal(before.includes("npm start"), false);
  });

  it("O5 first-run-integration: README wedge link before first bash block containing npm start", () => {
    const p = join(root, "docs", "first-run-integration.md");
    const s = readFileSync(p, "utf8");
    const iLink = s.indexOf(`README.md#${WEDGE_FRAGMENT}`);
    assert.ok(iLink >= 0, "README.md#wedge fragment link missing");
    const iNpmStartBlock = s.indexOf("```bash\nnpm start\n");
    assert.ok(iNpmStartBlock >= 0, "npm start bash block missing");
    assert.ok(iLink < iNpmStartBlock, "prerequisite link must precede npm start demo block");
  });

  it("O6 golden-path: first markdown link is README default path fragment", () => {
    const s = readFileSync(join(root, "docs", "golden-path.md"), "utf8");
    const m = s.match(/\[([^\]]*)\]\(([^)]+)\)/);
    assert.ok(m, "no markdown link found");
    assert.equal(m[2], README_DEFAULT_PATH_LINK, "first link must be README default path anchor");
  });

  it("O7 first-run: commercial anchors after first npm start instruction", () => {
    const s = readFileSync(join(root, "docs", "first-run-integration.md"), "utf8");
    const iDemo = s.indexOf("npm start");
    assert.ok(iDemo >= 0, "npm start missing");
    const iStripe = s.toLowerCase().indexOf("stripe");
    const iKey = s.indexOf("AGENTSKEPTIC_API_KEY");
    const iReserve = s.indexOf("POST /api/v1/usage/reserve");
    assert.ok(iStripe >= 0 && iKey >= 0 && iReserve >= 0, "commercial anchor set missing");
    assert.ok(iDemo < iStripe && iDemo < iKey && iDemo < iReserve, "demo must precede commercial block");
  });
});
