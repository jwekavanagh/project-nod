#!/usr/bin/env node
/**
 * RR-D: `/api/oss/claim-handoff` must not appear in marketing/docs copy except where explicitly allowed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const needle = "/api/oss/claim-handoff";
const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const docsDir = join(root, "docs");
const allowOssSot = "docs/oss-account-claim.md";
const allowJourney = "docs/eval-to-revenue-journey.md";

function* walkMarkdownFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      yield* walkMarkdownFiles(p);
    } else if (name.endsWith(".md")) {
      yield p;
    }
  }
}

function legacyOnlyInCompatibilityFence(text) {
  if (!text.includes(needle)) return true;
  const open = "```Compatibility_308_only";
  const start = text.indexOf(open);
  if (start < 0) return false;
  const afterOpen = text.indexOf("\n", start);
  if (afterOpen < 0) return false;
  const close = text.indexOf("```", afterOpen + 1);
  if (close < 0) return false;
  const head = text.slice(0, start);
  const tail = text.slice(close + 3);
  if (head.includes(needle) || tail.includes(needle)) return false;
  const fence = text.slice(start, close + 3);
  return fence.includes(needle);
}

let failed = false;
for (const abs of walkMarkdownFiles(docsDir)) {
  const rel = relative(root, abs).replace(/\\/g, "/");
  const text = readFileSync(abs, "utf8");
  if (!text.includes(needle)) continue;
  if (rel === allowOssSot) continue;
  if (rel === allowJourney) {
    if (!legacyOnlyInCompatibilityFence(text)) {
      console.error(
        `${rel}: ${needle} must appear only inside the \`\`\`Compatibility_308_only fenced block (RR-D).`,
      );
      failed = true;
    }
    continue;
  }
  console.error(`${rel}: forbidden substring ${JSON.stringify(needle)} (steady-state docs use /verify/link).`);
  failed = true;
}

if (failed) process.exit(1);
