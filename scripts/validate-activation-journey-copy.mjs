#!/usr/bin/env node
/**
 * Merge gate: proof-first activation copy on /integrate, /integrate/guided, and doc mirrors.
 * Invoked from repo-policy-and-api-guards (verification:truth).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function fail(msg) {
  console.error(`validate-activation-journey-copy: ${msg}`);
  process.exit(1);
}

function readUtf8(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const LEGACY_WEBSITE_PRODUCT =
  "leads with a **Guided: generate registry and quick input**";

const MANDATORY_INTEGRATE_SENTENCE =
  "The hosted guided page helps you produce local CLI inputs; it does not replace a first quick proof, and registry drafting is optional formalization after you have a meaningful verification outcome.";

const OPTIONAL_ACCELERATOR = "Optional accelerator: [/integrate/guided]";

const HOME_FORBIDDEN = [
  new RegExp("maintain\\s+.{0,80}?registry\\s+before", "i"),
  new RegExp("registry\\s+before\\s+(you\\s+)?can\\s+(verify|trust|check)", "i"),
];

const wpe = readUtf8("docs/website-product-experience.md");
if (wpe.includes(LEGACY_WEBSITE_PRODUCT)) {
  fail("docs/website-product-experience.md still contains stale guided-first bullet substring");
}

const integrateMd = readUtf8("docs/integrate.md");
if (!integrateMd.includes(MANDATORY_INTEGRATE_SENTENCE)) {
  fail("docs/integrate.md must contain the mandatory hosted-guided sentence (byte-for-byte)");
}
const accIdx = integrateMd.indexOf(OPTIONAL_ACCELERATOR);
const sentIdx = integrateMd.indexOf(MANDATORY_INTEGRATE_SENTENCE);
if (accIdx === -1) {
  fail("docs/integrate.md must retain Optional accelerator line for ordering anchor");
}
if (sentIdx <= accIdx) {
  fail("docs/integrate.md: mandatory guided sentence must appear after Optional accelerator line");
}

const guidedFirst = readUtf8("docs/guided-first-verification.md");
if (!/integrate\.md/i.test(guidedFirst)) {
  fail("docs/guided-first-verification.md must link or name integrate.md");
}
if (!/(quick|proof|first proof)/i.test(guidedFirst)) {
  fail("docs/guided-first-verification.md must mention quick or proof (activation spine)");
}

const integratePage = readUtf8("website/src/app/integrate/page.tsx");
if (!integratePage.includes("truthCheckCommand")) {
  fail("website/src/app/integrate/page.tsx must reference truthCheckCommand");
}
if (!integratePage.includes('data-testid="integrate-truth-check-commands"')) {
  fail("website/src/app/integrate/page.tsx must define integrate-truth-check-commands");
}

const guidedPage = readUtf8("website/src/app/integrate/guided/page.tsx");
for (const s of ["Formalize", "agentskeptic check", "agentskeptic enforce"]) {
  if (!guidedPage.includes(s)) {
    fail(`website/src/app/integrate/guided/page.tsx must contain ${JSON.stringify(s)}`);
  }
}
if (!guidedPage.includes('data-testid="integrate-guided-graduation"')) {
  fail("website/src/app/integrate/guided/page.tsx must define integrate-guided-graduation");
}
if (/className="lede"[^>]*>\s*Paste a registry-draft request/.test(guidedPage)) {
  fail("guided/page.tsx: first lede must not open with Paste a registry-draft request (draft-first)");
}

const layout = readUtf8("website/src/app/integrate/guided/layout.tsx");
const descM = layout.match(/const\s+description\s*=\s*`([^`]+)`/);
if (!descM) {
  fail("website/src/app/integrate/guided/layout.tsx must use const description = `...`");
}
const desc = descM[1];
if (!/(quick|proof|preview)/i.test(desc)) {
  fail("guided layout description must mention quick, proof, or preview (case-insensitive)");
}

for (const rel of ["website/src/app/page.tsx", "website/src/content/productCopy.ts"]) {
  const body = readUtf8(rel);
  for (const re of HOME_FORBIDDEN) {
    if (re.test(body)) {
      fail(`${rel} matched forbidden homepage contradiction regex: ${re}`);
    }
  }
}

console.log("validate-activation-journey-copy: ok");
