#!/usr/bin/env node
/**
 * Drift gate: canonical /integrate + first-run integrator onboarding shape after crossing cutover.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function fail(msg) {
  console.error(`validate-integrator-onboarding-shape: ${msg}`);
  process.exit(1);
}

const pc = readFileSync(join(root, "website", "src", "content", "productCopy.ts"), "utf8");
if (/\brunCaption\b/.test(pc) || /\brunHeading\b/.test(pc)) {
  fail("productCopy.ts must not define runCaption or runHeading");
}

const leadMatch = pc.match(/optionalSpineLead:\s*\n\s*"([^"]*)"/);
if (!leadMatch) fail("could not parse optionalSpineLead string from productCopy.ts");
if (leadMatch[1].length > 320) fail(`optionalSpineLead exceeds 320 chars (${leadMatch[1].length})`);

const firstRun = readFileSync(join(root, "docs", "first-run-integration.md"), "utf8");
const bannedFirstRun = [
  "## Bootstrap and verify on your sources",
  "Then run contract verification on **your** paths",
  "```bash\nagentskeptic verify-integrator-owned",
];
for (const b of bannedFirstRun) {
  if (firstRun.includes(b)) fail(`first-run-integration.md contains banned fragment: ${JSON.stringify(b)}`);
}

const page = readFileSync(join(root, "website", "src", "app", "integrate", "page.tsx"), "utf8");
const retIdx = page.indexOf("return (");
if (retIdx === -1) fail("integrate/page.tsx must contain return (");
const jsx = page.slice(retIdx);
const d = jsx.indexOf("<details");
const i = jsx.indexOf("<IntegrateActivationBlock");
if (d === -1) fail("integrate/page.tsx must contain <details");
if (i === -1) fail("integrate/page.tsx must render IntegrateActivationBlock in JSX");
if (i < d) fail("IntegrateActivationBlock must appear after the first <details in JSX");
if (!page.includes("IntegrateCrossingCommands")) fail("integrate/page.tsx must render IntegrateCrossingCommands");

console.log("validate-integrator-onboarding-shape: ok");
