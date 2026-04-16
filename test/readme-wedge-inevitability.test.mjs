/**
 * Product requirement: buy-vs-build narrative is inevitable on primary doc paths—README first
 * after discovery, anti-script framing present, first-run and golden-path point to README wedge
 * before demo / as canonical entry.
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

/** Minimum concepts: drift, ownership, shared contract/registry, CI or audit gates */
const ANTI_SCRIPT_TOKENS = [/drift/i, /ownership/i, /registry/i, /\bCI\b|audit/i];

describe("readme wedge inevitability", () => {
  it("O1 README: wedge heading before core mechanism, public anchors, and Try it", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const iWedge = readme.indexOf(WEDGE_HEADING_LINE);
    const iOne = readme.indexOf("**Core mechanism:**");
    const iAnchors = readme.indexOf("<!-- public-product-anchors:start -->");
    const iTry = readme.indexOf("## Try it (about one minute)");
    assert.ok(iWedge >= 0, "wedge heading missing");
    assert.ok(iOne >= 0, "core mechanism line missing");
    assert.ok(iAnchors >= 0, "public-product-anchors missing");
    assert.ok(iTry >= 0, "## Try it missing");
    assert.ok(iWedge < iOne, "wedge must precede one-sentence value");
    assert.ok(iOne < iAnchors, "core mechanism must precede public anchors");
    assert.ok(iAnchors < iTry, "public anchors must precede Try it");
  });

  it("O2 README: anti-script concept bundle (drift, ownership, registry/contract, CI or audit)", () => {
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

  it("O3 first-run-integration: README wedge link before first bash block containing npm start", () => {
    const p = join(root, "docs", "first-run-integration.md");
    const s = readFileSync(p, "utf8");
    const iLink = s.indexOf(`README.md#${WEDGE_FRAGMENT}`);
    assert.ok(iLink >= 0, "README.md#wedge fragment link missing");
    const iNpmStartBlock = s.indexOf("```bash\nnpm start\n");
    assert.ok(iNpmStartBlock >= 0, "npm start bash block missing");
    assert.ok(iLink < iNpmStartBlock, "prerequisite link must precede npm start demo block");
  });

  it("O4 golden-path: first markdown link is README buy-vs-build fragment", () => {
    const s = readFileSync(join(root, "docs", "golden-path.md"), "utf8");
    const m = s.match(/\[([^\]]*)\]\(([^)]+)\)/);
    assert.ok(m, "no markdown link found");
    assert.equal(m[2], README_WEDGE_LINK, "first link must be README wedge anchor");
  });

  it("O5 first-run: commercial anchors after first npm start instruction", () => {
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
