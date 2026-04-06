/**
 * Docs contract: SSOT headings order + README above-the-fold pins.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const contractPath = join(__dirname, "docs-contract-headings.json");
const { headings } = JSON.parse(readFileSync(contractPath, "utf8"));

describe("docs contract (SSOT + README)", () => {
  it("execution-truth-layer.md headings appear in committed order", () => {
    const ssot = readFileSync(join(root, "docs", "execution-truth-layer.md"), "utf8");
    let pos = 0;
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const idx = ssot.indexOf(h, pos);
      assert.ok(idx >= 0, `missing or out-of-order heading: ${h}`);
      pos = idx + h.length;
    }
  });

  it("README above-the-fold covers visitor outcomes (problem, persona, differentiation, try path)", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const head = readme.slice(0, 5500);
    assert.ok(
      head.includes("## The problem (and cost of ignoring it)"),
      "problem section in first screen",
    );
    assert.ok(head.includes("## Is this for you?"), "persona section in first screen");
    assert.ok(
      head.includes("## How this differs from logs, tests, and observability"),
      "differentiation section in first screen",
    );
    assert.ok(head.includes("## Try it in under five minutes"), "fast try path before deep CI");
    assert.ok(
      /If you ignore that gap/i.test(head) && /cost/i.test(head),
      "cost of inaction stated in prose",
    );
    assert.ok(
      /This is for you if/i.test(head) && /This is not for you if/i.test(head),
      "self-identification lists",
    );
  });
});
