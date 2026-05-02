#!/usr/bin/env node
/**
 * Drift gate: primary surfaces must keep truth-check-first positioning (normative: integrate plan).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function fail(msg) {
  console.error(`validate-primary-truth-check-drift: ${msg}`);
  process.exit(1);
}

const integratePath = join(root, "docs", "integrate.md");
const integrateRaw = readFileSync(integratePath, "utf8");
const advMatch = integrateRaw.match(/^## Advanced\b/im);
const integratePrimary = advMatch ? integrateRaw.slice(0, advMatch.index) : integrateRaw;
const loopRecommended =
  /recommended default[^\n]{0,120}loop|loop[^\n]{0,120}recommended default/is.test(integratePrimary);
if (loopRecommended) {
  fail("docs/integrate.md before ## Advanced must not pair 'recommended default' with 'loop'");
}

const firstFence = integratePrimary.indexOf("```bash");
if (firstFence >= 0) {
  const fenceEnd = integratePrimary.indexOf("```", firstFence + 7);
  const firstBash = integratePrimary.slice(firstFence, fenceEnd > 0 ? fenceEnd + 3 : integratePrimary.length);
  if (firstBash.includes("agentskeptic activate") && !firstBash.includes("agentskeptic check")) {
    fail("docs/integrate.md first fenced bash block must not lead with activate without check");
  }
}

const readme = readFileSync(join(root, "README.md"), "utf8");
const a0 = readme.indexOf("<!-- adoption-canonical:start -->");
const a1 = readme.indexOf("<!-- adoption-canonical:end -->");
if (a0 < 0 || a1 <= a0) fail("README adoption markers missing");
const adopt = readme.slice(a0, a1);
const firstBashIdx = adopt.indexOf("```bash");
if (firstBashIdx >= 0) {
  const fbEnd = adopt.indexOf("```", firstBashIdx + 7);
  const block = adopt.slice(firstBashIdx, fbEnd > 0 ? fbEnd + 3 : adopt.length);
  if (block.includes("--workflow-id") && !block.includes("check")) {
    fail("README adoption first bash block: bare --workflow-id without check is demoted");
  }
}

const integratePage = readFileSync(join(root, "website", "src", "app", "integrate", "page.tsx"), "utf8");
const badGolden =
  /golden-path\.md[\s\S]{0,200}first-run onboarding|first-run onboarding[\s\S]{0,200}golden-path\.md/.test(
    integratePage,
  );
if (badGolden) {
  fail("integrate/page.tsx must not equate golden-path.md with first-run onboarding");
}

console.log("validate-primary-truth-check-drift: ok");
