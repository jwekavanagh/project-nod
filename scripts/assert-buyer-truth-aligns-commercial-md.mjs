#!/usr/bin/env node
/**
 * Buyer Truth quota narration must cite the commercial SSOT pooled policy (anchor text parity).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bt = JSON.parse(readFileSync(join(root, "config", "buyer-truth.v1.json"), "utf8"));
const commercialMd = readFileSync(join(root, "docs", "commercial.md"), "utf8");

const pooled = /\baccount\s*[-_]?\s*pooled\b/i.test(commercialMd) || /\baccount-pooled\b/i.test(commercialMd);
if (!pooled) {
  console.error("commercial.md appears to omit account-pooled quota semantics anchor.");
  process.exit(1);
}

const narration = `${bt.pricing.pricingHeroSubtitleTemplate} ${bt.pricing.paidVerificationTemplate}`;
if (!/\bpooled\b|\bpool(ed|ing)?\b/i.test(narration) && !/\baccount[- ]pool/i.test(narration)) {
  console.error("buyer-truth pricing templates must cite pooled usage (align with docs/commercial.md).");
  process.exit(1);
}
console.error("buyer-truth ↔ commercial.md anchor: ok");
