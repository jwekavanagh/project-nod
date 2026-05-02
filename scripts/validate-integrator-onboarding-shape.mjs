#!/usr/bin/env node
/**
 * Drift gate: `/integrate` is pack-led only (config/marketing.json); no legacy activation blocks.
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

const marketingPath = join(root, "config", "marketing.json");
const marketingRaw = JSON.parse(readFileSync(marketingPath, "utf8"));
const tcc = marketingRaw.integratePage?.truthCheckCommand;
if (typeof tcc !== "string" || !tcc.includes("agentskeptic check")) {
  fail("config/marketing.json integratePage.truthCheckCommand must include the substring agentskeptic check");
}
const plc = marketingRaw.integratePage?.packLedCommand;
if (typeof plc !== "string" || !plc.includes("agentskeptic activate")) {
  fail("config/marketing.json integratePage.packLedCommand must include the substring agentskeptic activate");
}
const actPos = plc.indexOf("activate");
const crossPos = plc.indexOf("crossing");
if (actPos === -1 || crossPos === -1 || actPos >= crossPos) {
  fail(
    `config/marketing.json integratePage.packLedCommand must list activate before crossing (positions ${String(actPos)} / ${String(crossPos)})`,
  );
}

const pc = readFileSync(join(root, "website", "src", "content", "productCopy.ts"), "utf8");
if (/\brunCaption\b/.test(pc) || /\brunHeading\b/.test(pc)) {
  fail("productCopy.ts must not define runCaption or runHeading");
}
if (/\bintegrateActivation\b/.test(pc)) {
  fail("productCopy.ts must not export integrateActivation (use config/marketing.json for /integrate)");
}

const integrateSsot = readFileSync(join(root, "docs", "integrate.md"), "utf8");
const bannedIntegratePrimary = [
  "## Bootstrap and verify on your sources",
  "Then run contract verification on **your** paths",
  "```bash\nagentskeptic verify-integrator-owned",
];
for (const b of bannedIntegratePrimary) {
  if (integrateSsot.includes(b)) fail(`integrate.md contains banned fragment: ${JSON.stringify(b)}`);
}

const page = readFileSync(join(root, "website", "src", "app", "integrate", "page.tsx"), "utf8");
if (!page.includes("marketing.integratePage")) {
  fail("integrate/page.tsx must read pack-led copy from marketing.integratePage");
}
if (!page.includes("truthCheckCommand")) fail("integrate/page.tsx must reference truthCheckCommand");
if (!page.includes("packLedCommand")) fail("integrate/page.tsx must render packLedCommand");
if (!page.includes("<pre")) fail("integrate/page.tsx must contain a <pre> for commands");
const truthIdx = page.indexOf("truthCheckCommand");
const packIdx = page.indexOf("packLedCommand");
if (truthIdx === -1 || packIdx === -1 || truthIdx >= packIdx) {
  fail("integrate/page.tsx must reference truthCheckCommand before packLedCommand");
}
if (page.includes("IntegrateActivationBlock") || page.includes("IntegrateCrossingCommands")) {
  fail("integrate/page.tsx must not import legacy IntegrateActivationBlock / IntegrateCrossingCommands");
}
if (page.includes("<details")) {
  fail("integrate/page.tsx must not use <details> (normative copy is on GitHub)");
}

console.log("validate-integrator-onboarding-shape: ok");
