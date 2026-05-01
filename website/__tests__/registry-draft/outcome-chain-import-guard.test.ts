import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(webRoot, "__tests__", "registry-draft", "outcome-chain.test.ts");

describe("registry-draft outcome-chain import guard", () => {
  it("requires a single static import from agentskeptic/bootstrapPackSynthesis", () => {
    const src = readFileSync(target, "utf8");
    const re = /from\s+["']agentskeptic\/bootstrapPackSynthesis["']/g;
    const hits = [...src.matchAll(re)];
    expect(hits.length).toBe(1);
    expect(src).toMatch(
      /import\s*\{[^}]*\bsynthesizeQuickInputUtf8FromOpenAiV1\b[^}]*\}\s*from\s*["']agentskeptic\/bootstrapPackSynthesis["']/,
    );
  });
});
