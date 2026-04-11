import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = require(join(root, "scripts", "discovery-acquisition.lib.cjs"));
const { normalize } = require(join(root, "scripts", "public-product-anchors.cjs"));
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

test("discovery JSON validates against schema", () => {
  lib.validateDiscoveryAcquisition(root);
});

test("README discovery fold body matches buildDiscoveryFoldBody", () => {
  const discovery = lib.loadDiscoveryAcquisition(root);
  const anchors = JSON.parse(readFileSync(join(root, "config", "public-product-anchors.json"), "utf8"));
  const origin = normalize(anchors.productionCanonicalOrigin);
  const expected = lib.buildDiscoveryFoldBody(discovery, origin);
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const start = "<!-- discovery-acquisition-fold:start -->";
  const end = "<!-- discovery-acquisition-fold:end -->";
  const i0 = readme.indexOf(start);
  const i1 = readme.indexOf(end);
  assert.ok(i0 >= 0 && i1 > i0);
  const inner = readme.slice(i0 + start.length, i1).trim();
  assert.equal(inner, expected.trim());
});

test("README discovery-readme-title matches readmeTitle", () => {
  const discovery = lib.loadDiscoveryAcquisition(root);
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const tStart = "<!-- discovery-readme-title:start -->";
  const tEnd = "<!-- discovery-readme-title:end -->";
  const i0 = readme.indexOf(tStart);
  const i1 = readme.indexOf(tEnd);
  assert.ok(i0 >= 0 && i1 > i0);
  const inner = readme.slice(i0 + tStart.length, i1).trim();
  assert.equal(inner, `# ${discovery.readmeTitle}`);
});

test("invalid visitorProblemAnswer fails schema (negative)", () => {
  const schemaPath = join(root, "config", "discovery-acquisition.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const bad = {
    schemaVersion: 1,
    slug: "/database-truth-vs-traces",
    visitorProblemAnswer: "x".repeat(50),
    heroTitle: "t",
    heroSubtitle: "t",
    homepageAcquisitionCtaLabel: "1234567890",
    pageMetadata: { title: "t", description: "t" },
    sections: [
      { heading: "a", paragraphs: ["p"] },
      { heading: "b", paragraphs: ["p"] },
      { heading: "c", paragraphs: ["p"] },
      { heading: "d", paragraphs: ["p"] },
    ],
    llms: {
      intentPhrases: ["1", "2", "3", "4", "5"],
      notFor: ["1", "2", "3"],
      relatedQueries: ["1", "2", "3", "4", "5"],
    },
    readmeFold: { templateLines: ["x"] },
  };
  assert.equal(validate(bad), false);
});

test("invalid pageMetadata.description fails schema (negative)", () => {
  const schemaPath = join(root, "config", "discovery-acquisition.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const bad = {
    schemaVersion: 1,
    slug: "/database-truth-vs-traces",
    visitorProblemAnswer:
      "Teams ship agent workflows where traces look green while the database row is wrong. Workflow Verifier compares structured tool activity to read-only SQL against SQLite at verification time: it tells you whether observed state matched expectations—not proof of execution.",
    heroTitle: "Your workflow said it worked. Did the database actually change?",
    heroSubtitle:
      "Workflow Verifier answers with read-only SQL at verification time—not with trace success flags or chat narratives.",
    homepageAcquisitionCtaLabel: "Why traces are not database truth",
    readmeTitle: "Workflow Verifier — when traces say success but your database does not match",
    homepageHero: {
      what: "You shipped an agent run and the trace says success. This product runs read-only SQL to check rows.",
      why: "Traces do not prove the row exists with the right values. That gap ships silent failures.",
      when: "Use it after a workflow when you need ground truth before customer-facing actions or a CI gate.",
    },
    pageMetadata: {
      title: "Database truth vs traces — Workflow Verifier",
      description: "Too short, missing required length and product-law patterns for registry metadata.",
    },
    sections: [
      { heading: "a", paragraphs: ["p"] },
      { heading: "b", paragraphs: ["p"] },
      { heading: "c", paragraphs: ["p"] },
      { heading: "d", paragraphs: ["p"] },
    ],
    demandMoments: [
      "Green LangGraph trace but wrong Postgres row",
      "Tool loop reported success; CRM state does not match",
      "CI passed on logs; database side effect never showed up",
    ],
    cliFollowupLines: ["More context: {{ACQUISITION_URL}}"],
    llms: {
      intentPhrases: ["1", "2", "3", "4", "5"],
      notFor: ["1", "2", "3"],
      relatedQueries: ["1", "2", "3", "4", "5"],
    },
    readmeFold: { templateLines: ["x"] },
  };
  assert.equal(validate(bad), false);
});
