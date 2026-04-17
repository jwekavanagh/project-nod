/**
 * Ensures outcome-chain test imports synthesis only from agentskeptic/bootstrapPackSynthesis.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const target = join(root, "test", "registry-draft-outcome-chain.test.mjs");

describe("registry-draft outcome-chain import guard", () => {
  it("requires a single static import from agentskeptic/bootstrapPackSynthesis", () => {
    const src = readFileSync(target, "utf8");
    const re = /from\s+["']agentskeptic\/bootstrapPackSynthesis["']/g;
    const hits = [...src.matchAll(re)];
    assert.equal(hits.length, 1, "expected exactly one bootstrapPackSynthesis import");
    assert.match(
      src,
      /import\s*\{[^}]*\bsynthesizeQuickInputUtf8FromOpenAiV1\b[^}]*\}\s*from\s*["']agentskeptic\/bootstrapPackSynthesis["']/,
      "expected named import of synthesizeQuickInputUtf8FromOpenAiV1",
    );
  });
});
