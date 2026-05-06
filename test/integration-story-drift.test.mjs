/**
 * Phase 7: narrow integration-story drift gate — README / integrate / wrappers / discovery
 * surfaces must keep `agentskeptic check` as the default first-run path and preserve the
 * Outcome Certificate + truth_check_verdict contract; commercial enforce and loop remain
 * explicitly framed as non-default paths.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function maybeRead(rel) {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/** @param {string} text @param {string} needle @param {number} radius */
function windowsAround(text, needle, radius = 300) {
  const out = [];
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  let i = 0;
  while (true) {
    const idx = lower.indexOf(n, i);
    if (idx < 0) break;
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + needle.length + radius);
    out.push(text.slice(start, end));
    i = idx + needle.length;
  }
  return out;
}

/** @param {string} text @param {string} needle @param {string[]} allowedTerms @param {string} contextLabel */
function assertEveryOccurrenceWindowIncludesAny(text, needle, allowedTerms, contextLabel) {
  const wins = windowsAround(text, needle);
  if (wins.length === 0) return;
  for (let wi = 0; wi < wins.length; wi++) {
    const w = wins[wi].toLowerCase();
    const ok = allowedTerms.some((t) => w.includes(t.toLowerCase()));
    assert.ok(
      ok,
      `${contextLabel}: occurrence ${wi + 1} of ${JSON.stringify(needle)} must be near one of: ${allowedTerms.join(", ")}`,
    );
  }
}

const ENFORCE_FRAMING = [
  "commercial",
  "stateful",
  "opt-in",
  "later",
  "baseline",
  "drift",
  "acceptance",
  "enforcement",
  "api key",
  "agentskeptic_api_key",
];

const LOOP_FRAMING = [
  "optional",
  "advanced",
  "feedback loop",
  "run history",
  "iterative",
  " after",
  "not the default",
  "inner-loop",
];

const QVR_SAFE = [
  "internal",
  "not stdout",
  "not emitted on stdout",
  "processing",
  "report structure",
  "not the",
  "stdout contract",
  "cli stdout",
];

const API_VERIFY_SAFE = ["demo", "example", "non-production", "not the production", "not "];

const ADOPTION_REL_PATHS = [
  "README.md",
  "docs/integrate.md",
  "docs/ambient-ci-distribution.md",
  "docs/cursor-integration.md",
  "docs/shareable-verification-reports.md",
  "docs/commercial.md",
  ".github/actions/agentskeptic-check/action.yml",
  "examples/cursor/agentskeptic-check.mdc",
  "scripts/discovery-payload.lib.cjs",
  "llms.txt",
];

const GA_PAIRING_REL_PATHS = ["README.md", "docs/integrate.md", "docs/ambient-ci-distribution.md", "llms.txt"];

const NEEDLE_ENFORCE = "agentskeptic enforce";
const NEEDLE_LOOP = "agentskeptic loop";
const NEEDLE_QVR = "QuickVerifyReport";
const NEEDLE_API_VERIFY = "/api/verify";

const COMMERCIAL_YML = "agentskeptic-commercial.yml";
const CHECK_YML = "agentskeptic-check.yml";

function assertSdkTruthCheck(text, label) {
  assert.match(
    text,
    /agentskeptic check|agentskeptic@latest\s+check|`agentskeptic check`|npx\s+agentskeptic\s+check/,
    `${label}: must document agentskeptic check`,
  );
  assert.match(
    text,
    /AgentSkeptic\.check|\w+\.check\s*\(\s*\{/,
    `${label}: must document SDK check (AgentSkeptic.check or await *.check({…}))`,
  );
}

function assertCheckMention(text, label) {
  assert.match(
    text,
    /agentskeptic check|agentskeptic@latest\s+check|`agentskeptic check`|npx\s+agentskeptic\s+check/,
    `${label}: must mention agentskeptic check`,
  );
}

function assertResultContract(text, label) {
  const l = text.toLowerCase();
  assert.match(l, /outcome certificate/, `${label}: Outcome Certificate`);
  assert.match(l, /truth_check_verdict/, `${label}: truth_check_verdict`);
  assert.match(l, /not_trusted|not trusted/, `${label}: not_trusted`);
  assert.match(l, /\btrusted\b/, `${label}: trusted`);
  assert.match(l, /\bunknown\b/, `${label}: unknown`);
}

describe("integration story drift gate", () => {
  test("invariant 1: default path is check (core surfaces + wrappers + discovery)", () => {
    const readme = read("README.md");
    const integrate = read("docs/integrate.md");
    assertSdkTruthCheck(readme, "README.md");
    assertSdkTruthCheck(integrate, "docs/integrate.md");

    assertCheckMention(read("docs/ambient-ci-distribution.md"), "docs/ambient-ci-distribution.md");
    assertCheckMention(read("docs/cursor-integration.md"), "docs/cursor-integration.md");
    assertCheckMention(read("examples/cursor/agentskeptic-check.mdc"), "examples/cursor/agentskeptic-check.mdc");
    assertSdkTruthCheck(read("llms.txt"), "llms.txt");
    assertSdkTruthCheck(read("scripts/discovery-payload.lib.cjs"), "scripts/discovery-payload.lib.cjs");

    const gaCheck = read("examples/github-actions/agentskeptic-check.yml");
    assert.match(
      gaCheck,
      /agentskeptic check|agentskeptic-check|mode:\s*check|\.github\/actions\/agentskeptic-check/,
      "examples/github-actions/agentskeptic-check.yml must wrap or reference the check path",
    );

    const actionYml = read(".github/actions/agentskeptic-check/action.yml");
    assert.match(actionYml, /default:\s*"check"/, "action.yml mode default must be check");
  });

  test("invariant 2: result contract in primary docs", () => {
    for (const rel of ["README.md", "docs/integrate.md", "docs/ambient-ci-distribution.md", "docs/cursor-integration.md"]) {
      assertResultContract(read(rel), rel);
    }
  });

  test("invariant 3: enforce framed as commercial/stateful/opt-in wherever mentioned on adoption surfaces", () => {
    for (const rel of ADOPTION_REL_PATHS) {
      const body = maybeRead(rel);
      if (!body) continue;
      assertEveryOccurrenceWindowIncludesAny(body, NEEDLE_ENFORCE, ENFORCE_FRAMING, rel);
    }

    const gaDir = join(root, "examples", "github-actions");
    for (const name of readdirSync(gaDir).filter((f) => f.endsWith(".yml"))) {
      const rel = join("examples/github-actions", name).replace(/\\/g, "/");
      const body = read(rel);
      assertEveryOccurrenceWindowIncludesAny(body, NEEDLE_ENFORCE, ENFORCE_FRAMING, rel);
    }
  });

  test("invariant 3b: README / integrate / ambient / llms pair check example with commercial example", () => {
    for (const rel of GA_PAIRING_REL_PATHS) {
      const body = read(rel);
      if (!body.includes(COMMERCIAL_YML)) continue;
      assert.match(
        body,
        new RegExp(CHECK_YML.replace(/\./g, "\\.")),
        `${rel}: when ${COMMERCIAL_YML} is referenced, ${CHECK_YML} must appear too`,
      );
    }
  });

  test("invariant 4: loop is not the first-run path (ordering + framing)", () => {
    for (const rel of ["README.md", "docs/integrate.md"]) {
      const body = read(rel);
      const iCheck = body.indexOf("agentskeptic check");
      const iLoop = body.indexOf(NEEDLE_LOOP);
      if (iLoop >= 0 && iCheck >= 0) {
        assert.ok(iCheck < iLoop, `${rel}: agentskeptic check must appear before agentskeptic loop`);
      }
    }

    for (const rel of ADOPTION_REL_PATHS) {
      const body = maybeRead(rel);
      if (!body) continue;
      assertEveryOccurrenceWindowIncludesAny(body, NEEDLE_LOOP, LOOP_FRAMING, rel);
    }

    const gaDir = join(root, "examples", "github-actions");
    for (const name of readdirSync(gaDir).filter((f) => f.endsWith(".yml"))) {
      const rel = join("examples/github-actions", name).replace(/\\/g, "/");
      const body = read(rel);
      assertEveryOccurrenceWindowIncludesAny(body, NEEDLE_LOOP, LOOP_FRAMING, rel);
    }
  });

  test("invariant 5: QuickVerifyReport must not read as default check stdout", () => {
    const surfaces = [...ADOPTION_REL_PATHS, "schemas/openapi-commercial-v1.yaml"];
    for (const rel of surfaces) {
      const body = maybeRead(rel);
      if (!body || !body.includes(NEEDLE_QVR)) continue;
      assertEveryOccurrenceWindowIncludesAny(body, NEEDLE_QVR, QVR_SAFE, rel);
    }
  });

  test("invariant 6: OpenAPI — externalDocs, no production /api/verify path", () => {
    const raw = read("schemas/openapi-commercial-v1.yaml");
    const doc = parseYaml(raw);
    assert.ok(doc && typeof doc === "object");
    const ext = doc.externalDocs;
    assert.ok(ext && typeof ext === "object", "top-level externalDocs must exist");
    assert.equal(ext.url, "https://agentskeptic.com/integrate#first-truth-check");
    assert.match(String(ext.description ?? "").toLowerCase(), /agentskeptic check|agentskeptic\.check/);

    const paths = doc.paths;
    assert.ok(paths && typeof paths === "object", "paths must be an object");
    assert.equal(Object.prototype.hasOwnProperty.call(paths, "/api/verify"), false, "/api/verify must not be a path");

    const rt = doc["x-agentskeptic-runtime-truth-check"];
    const note = rt && typeof rt === "object" ? String(rt.note ?? "") : "";
    assert.match(note.toLowerCase(), /\/api\/verify/);
    assert.match(note.toLowerCase(), /demo|example|not the production/);
  });

  test("invariant 6b: /api/verify in adoption surfaces must be framed as demo/example/non-production", () => {
    for (const rel of ADOPTION_REL_PATHS) {
      const body = maybeRead(rel);
      if (!body || !body.includes(NEEDLE_API_VERIFY)) continue;
      assertEveryOccurrenceWindowIncludesAny(body, NEEDLE_API_VERIFY, API_VERIFY_SAFE, rel);
    }
  });

  test("invariant 7: composite action description keeps check as primary", () => {
    const actionYml = read(".github/actions/agentskeptic-check/action.yml");
    const desc = actionYml.match(/^description:\s*"(.*)"/m)?.[1] ?? actionYml.match(/^description:\s*(.+)$/m)?.[1] ?? "";
    assert.match(desc.toLowerCase(), /check/, "action description should mention check");
    assert.ok(
      desc.toLowerCase().indexOf("check") <= desc.toLowerCase().indexOf("enforce") || !/enforce/.test(desc),
      "action description should not position enforce before check",
    );
  });
});
