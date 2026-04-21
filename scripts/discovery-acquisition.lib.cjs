"use strict";

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const PLACEHOLDER_KEYS = [
  ["{{ORIGIN}}", "ORIGIN"],
  ["{{ACQUISITION_PATH}}", "ACQUISITION_PATH"],
  ["{{HERO_TITLE}}", "HERO_TITLE"],
  ["{{HERO_SUBTITLE}}", "HERO_SUBTITLE"],
  ["{{VISITOR_PROBLEM_ANSWER}}", "VISITOR_PROBLEM_ANSWER"],
  ["{{TERMINAL_TITLE}}", "TERMINAL_TITLE"],
  ["{{TERMINAL_TRANSCRIPT}}", "TERMINAL_TRANSCRIPT"],
];

/**
 * @param {string} root
 */
function discoveryPaths(root) {
  return {
    jsonPath: join(root, "config", "discovery-acquisition.json"),
    schemaPath: join(root, "config", "discovery-acquisition.schema.json"),
  };
}

/**
 * @param {string} root
 */
function loadDiscoveryAcquisition(root) {
  const { jsonPath } = discoveryPaths(root);
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

/**
 * @param {string} root
 * @returns {{ guides: string[]; examples: string[]; compare: string[] }}
 */
function listMarkdownSurfaceRoutesGrouped(root) {
  const base = join(root, "website", "content", "surfaces");
  /** @type {{ guides: string[]; examples: string[]; compare: string[] }} */
  const out = { guides: [], examples: [], compare: [] };
  for (const seg of /** @type {const} */ (["guides", "examples", "compare"])) {
    const dir = join(base, seg);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const raw = readFileSync(join(dir, f), "utf8");
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) throw new Error(`markdown-surfaces: missing frontmatter in ${seg}/${f}`);
      const rm = m[1].match(/^route:\s*(.+)$/m);
      if (!rm) throw new Error(`markdown-surfaces: missing route in ${seg}/${f}`);
      const route = rm[1].trim().replace(/^['"]|['"]$/g, "");
      if (seg === "guides") out.guides.push(route);
      else if (seg === "examples") out.examples.push(route);
      else out.compare.push(route);
    }
  }
  out.guides.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  out.examples.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  out.compare.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  return out;
}

/**
 * @param {Record<string, unknown>} discovery
 * @param {string} originNormalized
 */
function buildDiscoveryFoldBody(discovery, originNormalized) {
  const slug = String(discovery.slug);
  const demo = /** @type {{ title: string; transcript: string }} */ (discovery.shareableTerminalDemo);
  const map = {
    "{{ORIGIN}}": originNormalized,
    "{{ACQUISITION_PATH}}": slug,
    "{{HERO_TITLE}}": String(discovery.heroTitle),
    "{{HERO_SUBTITLE}}": String(discovery.heroSubtitle),
    "{{VISITOR_PROBLEM_ANSWER}}": String(discovery.visitorProblemAnswer),
    "{{TERMINAL_TITLE}}": String(demo.title),
    "{{TERMINAL_TRANSCRIPT}}": String(demo.transcript),
  };
  const lines = discovery.readmeFold.templateLines.map((line) => substituteTemplateLine(String(line), map));
  const body = lines.join("\n");
  const label = String(discovery.homepageAcquisitionCtaLabel);
  const mdLink = `\n\n[${escapeMdLinkText(label)}](${originNormalized}${slug})`;
  const full = body + mdLink;
  const urlInParens = `(${originNormalized}${slug})`;
  if (!full.includes(urlInParens)) {
    throw new Error("discovery-acquisition: fold body must include markdown URL in parentheses");
  }
  return full;
}

/**
 * @param {string} line
 * @param {Record<string, string>} map
 */
function substituteTemplateLine(line, map) {
  let out = line;
  for (const [token, _] of PLACEHOLDER_KEYS) {
    if (out.includes(token) && map[token] !== undefined) {
      out = out.split(token).join(map[token]);
    }
  }
  if (out.includes("{{")) {
    throw new Error(`discovery-acquisition: unresolved placeholder in template line: ${line}`);
  }
  return out;
}

/**
 * @param {string} s
 */
function escapeMdLinkText(s) {
  return s.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

/**
 * @param {string} baseLlms
 * @param {Record<string, unknown>} discovery
 * @param {string} canonicalOrigin
 */
function appendDiscoveryLlmsAppendix(baseLlms, discovery, canonicalOrigin) {
  const slug = String(discovery.slug);
  const origin = canonicalOrigin;
  const llms = discovery.llms;
  const bullets = (/** @type {string[]} */ arr) => arr.map((x) => `- ${x}`).join("\n");

  let out = String(baseLlms).replace(/\s*$/, "") + "\n";
  const root = join(__dirname, "..");
  const grouped = listMarkdownSurfaceRoutesGrouped(root);
  if (grouped.guides.length > 0) {
    out += "\n## Indexable guides\n";
    for (const path of grouped.guides) {
      out += `- ${origin}${path}\n`;
    }
  }
  if (grouped.examples.length > 0) {
    out += "\n## Indexable examples\n";
    for (const path of grouped.examples) {
      out += `- ${origin}${path}\n`;
    }
  }
  if (grouped.compare.length > 0) {
    out += "\n## Indexable comparisons\n";
    for (const path of grouped.compare) {
      out += `- ${origin}${path}\n`;
    }
  }
  const demo = discovery.shareableTerminalDemo;
  if (demo && typeof demo.title === "string" && typeof demo.transcript === "string") {
    out += `\n## ${demo.title}\n\n\`\`\`text\n${demo.transcript}\n\`\`\`\n`;
  }
  out += "\n## Intent phrases\n";
  out += bullets(llms.intentPhrases) + "\n";
  out += "\n## Not for\n";
  out += bullets(llms.notFor) + "\n";
  out += "\n## Related queries\n";
  out += bullets(llms.relatedQueries) + "\n";
  const rows = /** @type {{ moment: string; primaryRoute: string; relatedRoutes?: string[] }[]} */ (
    discovery.problemIndex
  );
  out += "\n## When this hurts (search-shaped)\n";
  for (const row of rows) {
    const paths = [row.primaryRoute, ...(Array.isArray(row.relatedRoutes) ? row.relatedRoutes : [])];
    const links = paths.map((p) => `${origin}${String(p).startsWith("/") ? String(p) : `/${String(p)}`}`);
    out += `- ${row.moment} — ${links.join(" · ")}\n`;
  }
  out += "\n## Problem framing (shareable)\n";
  out += `- Full page: ${origin}${slug}\n`;
  out += "\n## Visitor problem (canonical answer)\n\n";
  out += String(discovery.visitorProblemAnswer) + "\n";
  return out;
}

/**
 * @param {string} root
 */
function validateDiscoveryAcquisition(root) {
  const { jsonPath, schemaPath } = discoveryPaths(root);
  const discovery = JSON.parse(readFileSync(jsonPath, "utf8"));
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(discovery)) {
    const msg = ajv.errorsText(validate.errors, { separator: "\n" });
    throw new Error(`discovery-acquisition: schema validation failed:\n${msg}`);
  }
  const anchorsPath = join(root, "config", "public-product-anchors.json");
  const anchors = JSON.parse(readFileSync(anchorsPath, "utf8"));
  const { normalize } = require("./public-product-anchors.cjs");
  const origin = normalize(anchors.productionCanonicalOrigin);
  buildDiscoveryFoldBody(discovery, origin);
  const demo = discovery.shareableTerminalDemo;
  if (demo && String(demo.transcript).includes("```")) {
    throw new Error(
      "discovery-acquisition: shareableTerminalDemo.transcript must not contain markdown fence ```",
    );
  }
  return discovery;
}

module.exports = {
  loadDiscoveryAcquisition,
  buildDiscoveryFoldBody,
  appendDiscoveryLlmsAppendix,
  validateDiscoveryAcquisition,
  discoveryPaths,
  listMarkdownSurfaceRoutesGrouped,
};
