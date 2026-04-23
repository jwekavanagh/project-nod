/**
 * Structural validation: canonical epistemic-contract.md, consumer marker blocks,
 * forbidden duplicate prose outside canonical, generated website snippet parity.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readIntegratorSnippet } from "./lib/readEpistemicContractFence.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function normNl(s) {
  return s.replace(/\r\n/g, "\n");
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

/** @param {string} dir */
function walkMarkdownTs(dir, acc, base = root) {
  const full = join(base, dir);
  let st;
  try {
    st = statSync(full);
  } catch {
    return;
  }
  if (st.isFile()) {
    if (full.endsWith(".md") || full.endsWith(".tsx") || full.endsWith(".ts")) {
      acc.push(full);
    }
    return;
  }
  if (!st.isDirectory()) return;
  for (const name of readdirSync(full)) {
    if (name === "node_modules" || name === ".git") continue;
    walkMarkdownTs(join(dir, name), acc, base);
  }
}

/** @param {string} body */
/** @param {string} id */
function extractConsumerBlock(body, id) {
  const start = `<!-- epistemic-contract:consumer:${id} -->`;
  const end = `<!-- /epistemic-contract:consumer:${id} -->`;
  const b = normNl(body);
  const i0 = b.indexOf(start);
  const i1 = b.indexOf(end);
  if (i0 === -1 || i1 === -1 || i1 <= i0) return null;
  return b.slice(i0 + start.length, i1).replace(/^\n/, "").replace(/\n$/, "");
}

/** @param {string} genPath */
function parseGeneratedSnippet(genPath) {
  const raw = readFileSync(genPath, "utf8");
  const m = raw.match(/export const EPISTEMIC_CONTRACT_INTEGRATOR_SNIPPET:\s*string\s*=\s*([\s\S]*?);\s*$/m);
  if (!m) throw new Error(`${genPath}: could not parse EPISTEMIC_CONTRACT_INTEGRATOR_SNIPPET export`);
  return JSON.parse(m[1]);
}

function main() {
  const cfg = readJson("config/epistemic-contract-structure.json");
  const canonicalFull = join(root, cfg.canonicalPath);
  const canonicalBody = normNl(readFileSync(canonicalFull, "utf8"));

  if (!canonicalBody.includes(cfg.canonicalHeadingRequired)) {
    throw new Error(`Missing required heading in ${cfg.canonicalPath}: ${cfg.canonicalHeadingRequired}`);
  }

  const expectedSnippet = readIntegratorSnippet(root);

  for (const c of cfg.consumers) {
    const p = join(root, c.path);
    const body = normNl(readFileSync(p, "utf8"));
    const inner = extractConsumerBlock(body, c.id);
    if (inner === null) {
      throw new Error(`${c.path}: missing consumer markers for id ${c.id}`);
    }
    const want = normNl(c.exactInner);
    if (inner !== want) {
      throw new Error(
        `${c.path}: consumer block mismatch for ${c.id}.\n--- expected ---\n${want}\n--- got ---\n${inner}`,
      );
    }
  }

  const gmPath = join(root, "docs", "growth-metrics.md");
  const gmBody = normNl(readFileSync(gmPath, "utf8"));
  const rankingLine = normNl(cfg.rankingPointerLineGrowthMetrics);
  if (!gmBody.includes(rankingLine)) {
    throw new Error("docs/growth-metrics.md must contain exact ranking pointer line");
  }

  const readme = normNl(readFileSync(join(root, "README.md"), "utf8"));
  if (!readme.includes(cfg.readmeDocMapRowSubstring)) {
    throw new Error("README.md documentation map must link docs/epistemic-contract.md");
  }

  const vp = readFileSync(join(root, "docs", "verification-product.md"), "utf8");
  if (!vp.includes("epistemic-contract.md")) {
    throw new Error("verification-product.md authority matrix must reference epistemic-contract.md");
  }

  const genPath = join(root, cfg.generatedWebsitePath);
  const genSnippet = parseGeneratedSnippet(genPath);
  if (genSnippet !== expectedSnippet) {
    throw new Error(
      `${cfg.generatedWebsitePath} snippet does not match canonical fence (run: node scripts/sync-epistemic-contract-website.mjs)`,
    );
  }

  const excludeExact = new Set([
    cfg.canonicalPath.replaceAll("\\", "/"),
    cfg.generatedWebsitePath.replaceAll("\\", "/"),
  ]);

  /** @type {string[]} */
  const scanFiles = [];
  for (const g of cfg.scanGlobRoots) {
    if (g === "README.md") {
      scanFiles.push(join(root, "README.md"));
      continue;
    }
    walkMarkdownTs(g, scanFiles, root);
  }

  for (const abs of scanFiles) {
    const rel = relative(root, abs).replaceAll("\\", "/");
    if (rel.startsWith("website/node_modules")) continue;
    if (excludeExact.has(rel)) continue;

    const text = normNl(readFileSync(abs, "utf8"));
    for (const rule of cfg.forbiddenPatternsOutsideCanonical) {
      if (text.includes(rule.source)) {
        throw new Error(
          `Forbidden epistemic duplicate in ${rel} (rule ${rule.id}: ${rule.description}). Literal: ${JSON.stringify(rule.source)}`,
        );
      }
    }
  }

  console.log("validate-epistemic-contract-structure: OK");
}

main();
