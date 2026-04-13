#!/usr/bin/env node
/**
 * SSOT checks for partner quickstart: generated commands, prose doc, schema prefix, tools JSON not inlined in prose.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function fail(msg) {
  console.error("check-partner-quickstart-ssot:", msg);
  process.exit(1);
}

const gen = spawnSync(process.execPath, ["scripts/generate-partner-quickstart-commands.mjs", "--check"], {
  cwd: root,
  encoding: "utf8",
});
if (gen.status !== 0) {
  console.error(gen.stderr || gen.stdout);
  process.exit(gen.status ?? 1);
}

const prosePath = path.join(root, "docs", "first-run-integration.md");
if (!existsSync(prosePath)) fail("missing docs/first-run-integration.md");
const prose = readFileSync(prosePath, "utf8");

const toolsPath = path.join(root, "examples", "partner-quickstart", "partner.tools.json");
const T = JSON.stringify(JSON.parse(readFileSync(toolsPath, "utf8")));
if (prose.includes(T)) {
  fail("first-run-integration.md must not embed minified partner.tools.json (substring T)");
}

const linkNeedle = "[partner-quickstart-commands.md](partner-quickstart-commands.md)";
const linkCount = prose.split(linkNeedle).length - 1;
if (linkCount !== 1) {
  fail(`first-run-integration.md must contain exactly one link ${linkNeedle}; count=${linkCount}`);
}

const seedPath = path.join(root, "examples", "partner-quickstart", "partner.seed.sql");
const schemaPath = path.join(root, "examples", "partner-quickstart", "partner.schema-only.sql");
const seed = readFileSync(seedPath, "utf8");
const schemaOnly = readFileSync(schemaPath, "utf8");
const prefix = schemaOnly.trimEnd() + "\n";
if (!seed.startsWith(prefix)) {
  fail("partner.seed.sql must start with partner.schema-only.sql content + single newline");
}

const lgReadmePath = path.join(root, "examples", "langgraph-reference", "README.md");
if (!existsSync(lgReadmePath)) fail("missing examples/langgraph-reference/README.md");
const lgReadme = readFileSync(lgReadmePath, "utf8");
for (const line of lgReadme.split(/\n/)) {
  if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
    fail("examples/langgraph-reference/README.md must not contain fenced code blocks (no ``` or ~~~ line starts)");
  }
}
const lgBacklink = "verification-product-ssot.md#langgraph-reference-documentation-boundaries";
if (!lgReadme.includes(lgBacklink)) {
  fail(`examples/langgraph-reference/README.md must include backlink substring: ${lgBacklink}`);
}

const corePath = path.join(root, "scripts", "lib", "langgraphReferenceVerifyCore.mjs");
if (!existsSync(corePath)) fail("missing scripts/lib/langgraphReferenceVerifyCore.mjs");
const coreSrc = readFileSync(corePath, "utf8");
const forbiddenInCore = ["postgres", "POSTGRES", "PARTNER_POSTGRES", "--postgres-url", "postgresql://"];
for (const needle of forbiddenInCore) {
  if (coreSrc.includes(needle)) {
    fail(`langgraph reference verify core must not mention Postgres wiring (${needle})`);
  }
}

const commandsPath = path.join(root, "docs", "partner-quickstart-commands.md");
const commands = readFileSync(commandsPath, "utf8");
const lgHeading = "## LangGraph reference (emit events, then verify)";
if ((commands.split(lgHeading).length - 1) !== 1) {
  fail(`docs/partner-quickstart-commands.md must contain exactly one heading ${lgHeading}`);
}

const ssotPath = path.join(root, "docs", "verification-product-ssot.md");
const ssot = readFileSync(ssotPath, "utf8");
if (!ssot.includes("## Langgraph reference documentation boundaries")) {
  fail("docs/verification-product-ssot.md must contain ## Langgraph reference documentation boundaries");
}
if (!ssot.includes("| Boundary | Authoritative location | Notes |")) {
  fail("docs/verification-product-ssot.md Langgraph section must include the boundary table header row");
}

const webPxPath = path.join(root, "docs", "website-product-experience.md");
const webPx = readFileSync(webPxPath, "utf8");
if (!webPx.includes(lgBacklink)) {
  fail(`docs/website-product-experience.md must include backlink substring: ${lgBacklink}`);
}
if (webPx.includes("| Artifact | Owns |") || webPx.includes("| Must not own |")) {
  fail("docs/website-product-experience.md must not duplicate SSOT artifact table headers");
}
if (!prose.includes(lgBacklink)) {
  fail(`docs/first-run-integration.md must include backlink substring: ${lgBacklink}`);
}
if (prose.includes("| Artifact | Owns |") || prose.includes("| Must not own |")) {
  fail("docs/first-run-integration.md must not duplicate SSOT artifact table headers");
}

console.log("check-partner-quickstart-ssot: ok");
