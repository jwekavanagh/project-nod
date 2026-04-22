"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const BANNED = /\b(crossing success|PatternComplete|IntegrateSpine|Outcome Certificate|AC-)\b/i;

/**
 * @param {string} root
 */
function loadMarketing(root) {
  const p = join(root, "config", "marketing.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * @param {string} s
 */
function wordCount(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {Record<string, unknown>} m
 */
function validateMarketingValue(m) {
  if (m.schemaVersion !== 1) {
    throw new Error("marketing: schemaVersion must be 1");
  }
  const required = [
    "slug",
    "identityOneLiner",
    "productionCanonicalOrigin",
    "gitRepositoryUrl",
    "gitRepositoryGitUrl",
    "npmPackageUrl",
    "bugsUrl",
    "keywords",
    "heroTitle",
    "heroSubtitle",
    "visitorProblemAnswer",
    "heroOutcome",
    "heroMechanism",
    "guaranteeFootnote",
    "pageMetadata",
    "readmeFold",
    "shareableTerminalDemo",
    "cliFollowupLines",
    "r2",
    "site",
    "integratePage",
    "problemIndex",
    "llms",
  ];
  for (const k of required) {
    if (m[k] === undefined || m[k] === null) {
      throw new Error(`marketing: missing required key ${k}`);
    }
  }
  if (!Array.isArray(m.keywords) || m.keywords.length === 0) {
    throw new Error("marketing: keywords must be a non-empty array");
  }
  const ho = String(m.heroOutcome);
  if (wordCount(ho) > 20) {
    throw new Error(`marketing: heroOutcome must be at most 20 words (got ${wordCount(ho)})`);
  }
  if (String(m.heroMechanism).length > 200) {
    throw new Error("marketing: heroMechanism must be at most 200 characters");
  }
  for (const field of [ho, String(m.heroMechanism)]) {
    if (BANNED.test(field)) {
      throw new Error(`marketing: banned term in home hero text: ${field.slice(0, 80)}`);
    }
  }
  const g = String(m.guaranteeFootnote);
  if (!g.toLowerCase().includes("read-only")) {
    throw new Error("marketing: guaranteeFootnote must mention read-only");
  }
  if (g.includes("https://github.com/") || g.includes("http://github.com/")) {
    throw new Error("marketing: guaranteeFootnote must not include a GitHub URL (site-local copy only)");
  }
  if (g.toLowerCase().includes("causality")) {
    throw new Error("marketing: guaranteeFootnote must not contain the word causality");
  }
  const cmd = String(m.integratePage.packLedCommand);
  if (!cmd.includes("agentskeptic crossing")) {
    throw new Error("marketing: packLedCommand must include agentskeptic crossing");
  }
  if (!cmd.includes("--events")) {
    throw new Error("marketing: packLedCommand must be pack-led (--events)");
  }
  if (!cmd.includes("tools.json")) {
    throw new Error("marketing: packLedCommand must reference tools.json");
  }
  if (!Array.isArray(m.integratePage.requirements) || m.integratePage.requirements.length < 1) {
    throw new Error("marketing: integratePage.requirements must be a non-empty array");
  }
  if (m.integratePage.requirements.length < 1 || m.integratePage.requirements.length > 5) {
    throw new Error("marketing: integratePage.requirements must have 1–5 items");
  }
  const v = String(m.visitorProblemAnswer);
  if (v.toLowerCase().includes("causality")) {
    throw new Error("marketing: visitorProblemAnswer must not contain causality");
  }
  const demo = m.shareableTerminalDemo;
  if (demo && String(demo.transcript).includes("```")) {
    throw new Error("marketing: shareableTerminalDemo.transcript must not contain ```");
  }
  if (!m.readmeFold || !Array.isArray(m.readmeFold.templateLines)) {
    throw new Error("marketing: readmeFold.templateLines required");
  }
  return m;
}

/**
 * @param {string} root
 */
function validateMarketing(root) {
  return validateMarketingValue(loadMarketing(root));
}

if (require.main === module) {
  try {
    validateMarketing(join(__dirname, ".."));
    process.exit(0);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

module.exports = { validateMarketing, validateMarketingValue, loadMarketing };
