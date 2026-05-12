/**
 * Discovery payload contract: normalization, renders, truncation, upsert selection.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import { parse as parseYaml, stringify } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);
const dp = require(join(root, "scripts", "discovery-payload.lib.cjs"));
const da = require(join(root, "scripts", "discovery-acquisition.lib.cjs"));

const fixturePath = join(root, "test", "fixtures", "discovery-payload", "v1.json");
const goldenSummary = join(root, "test", "golden", "discovery-ci-summary.md");
const goldenPr = join(root, "test", "golden", "discovery-ci-pr-body.md");
const goldenCreate = join(root, "test", "golden", "github-issues-create-comment.json");

function loadFixture() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

test("fixture matches live buildDiscoveryPayload (no drift)", () => {
  const live = dp.buildDiscoveryPayload(root);
  const fixture = loadFixture();
  assert.deepEqual(fixture, live);
});

test("normalizeDiscoveryText: CRLF to LF and single trailing newline", () => {
  const a = dp.normalizeDiscoveryText("a\r\nb\r\n");
  assert.equal(a, "a\nb\n");
  assert.equal(a.endsWith("\n"), true);
  assert.equal(a.split("\n").length, 3);
});

test("tailLines returns last 20 of 40", () => {
  const lines = Array.from({ length: 40 }, (_, i) => `L${i + 1}`).join("\n");
  const t = dp.tailLines(lines, 20);
  assert.equal(t.length, 20);
  assert.equal(t[0], "L21");
  assert.equal(t[19], "L40");
});

test("renderCiSummaryMarkdownFromPayload matches golden", () => {
  const out = dp.renderCiSummaryMarkdownFromPayload(loadFixture());
  assert.equal(out, dp.normalizeDiscoveryText(readFileSync(goldenSummary, "utf8")));
});

test("renderCiPrBodyFromPayload empty capture matches golden", () => {
  const out = dp.renderCiPrBodyFromPayload(loadFixture(), {
    stderrText: "",
    workflowStdoutText: "",
  });
  assert.equal(out, readFileSync(goldenPr, "utf8"));
  assert.ok(out.includes(dp.PR_MARKER_LINE));
});

test("GitHub createComment envelope matches golden", () => {
  const body = dp.renderCiPrBodyFromPayload(loadFixture(), {
    stderrText: "",
    workflowStdoutText: "",
  });
  const env = JSON.stringify({ body }, null, 2) + "\n";
  assert.equal(env, readFileSync(goldenCreate, "utf8"));
});

test("llms.txt normalized equals renderLlmsTextFromPayload(build)", () => {
  const payload = dp.buildDiscoveryPayload(root);
  const rendered = dp.renderLlmsTextFromPayload(payload);
  const onDisk = readFileSync(join(root, "llms.txt"), "utf8");
  assert.equal(dp.normalizeDiscoveryText(onDisk), rendered);
});

test("rendered llms lists guides, examples, comparisons, then terminal demo", () => {
  const grouped = da.listMarkdownSurfaceRoutesGrouped(root);
  const payload = dp.buildDiscoveryPayload(root);
  const rendered = dp.renderLlmsTextFromPayload(payload);
  const hGuides = rendered.indexOf("## Indexable guides");
  const hExamples = rendered.indexOf("## Indexable examples");
  const hCompare = rendered.indexOf("## Indexable comparisons");
  const demoTitle = payload.appendix.shareableTerminalDemo.title;
  const hDemo = rendered.indexOf(`## ${demoTitle}`);
  assert.ok(hGuides >= 0);
  assert.ok(hExamples > hGuides);
  assert.ok(hCompare > hExamples);
  assert.ok(hDemo > hCompare);
  const origin = String(payload.links.site).replace(/\/$/, "");

  const guidesSection = rendered.slice(hGuides, hExamples);
  const guidesLines = guidesSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- https://"));
  assert.deepEqual(
    guidesLines,
    grouped.guides.map((path) => `- ${origin}${path}`),
  );

  const examplesSection = rendered.slice(hExamples, hCompare);
  const examplesLines = examplesSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- https://"));
  assert.deepEqual(
    examplesLines,
    grouped.examples.map((path) => `- ${origin}${path}`),
  );

  const compareSection = rendered.slice(hCompare, hDemo);
  const compareLines = compareSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- https://"));
  assert.deepEqual(
    compareLines,
    grouped.compare.map((path) => `- ${origin}${path}`),
  );
});

test("rendered llms Primary links include repo-raw OpenAPI and llms.txt", () => {
  const payload = dp.buildDiscoveryPayload(root);
  const rendered = dp.renderLlmsTextFromPayload(payload);
  assert.ok(rendered.includes("- OpenAPI (repo raw): "));
  assert.ok(rendered.includes("- llms.txt (repo raw): "));
  assert.ok(rendered.includes(String(payload.links.openapiRaw)));
  assert.ok(rendered.includes(String(payload.links.llmsRaw)));
});

test("rendered llms includes pasteable terminal demo before Intent phrases", () => {
  const payload = dp.buildDiscoveryPayload(root);
  const rendered = dp.renderLlmsTextFromPayload(payload);
  const hDemo = rendered.indexOf(`## ${payload.appendix.shareableTerminalDemo.title}`);
  const hIntent = rendered.indexOf("## Intent phrases");
  assert.ok(hDemo >= 0);
  assert.ok(hIntent > hDemo);
  assert.ok(rendered.includes(payload.appendix.shareableTerminalDemo.transcript.slice(0, 80)));
});

test("rendered llms includes When this hurts problemIndex section", () => {
  const payload = dp.buildDiscoveryPayload(root);
  const rendered = dp.renderLlmsTextFromPayload(payload);
  assert.ok(rendered.includes("## When this hurts (search-shaped)"));
  for (const row of payload.appendix.problemIndex) {
    assert.ok(rendered.includes(row.moment), row.moment);
  }
});

test("assertUtf8ByteLength throws when over limit", () => {
  assert.throws(() => dp.assertUtf8ByteLength("x", "y", 0), /exceeds max/);
});

test("summary markdown exceeds 65KB throws", () => {
  const fx = loadFixture();
  const huge = {
    ...fx,
    identityOneLiner: "x".repeat(70_000),
  };
  assert.throws(() => dp.renderCiSummaryMarkdownFromPayload(huge), /exceeds max/);
});

test("PR body truncates stderr from start until under 10KB", () => {
  const fx = loadFixture();
  const bigStderr = Array.from({ length: 500 }, (_, i) => `E${i} `.repeat(40)).join("\n");
  const out = dp.renderCiPrBodyFromPayload(fx, {
    stderrText: bigStderr,
    workflowStdoutText: '{"x":1}',
  });
  assert.ok(dp.utf8ByteLength(out) <= dp.MAX_PR_BODY_UTF8_BYTES);
  assert.ok(out.includes(dp.PR_MARKER_LINE));
});

test("selectPrCommentUpsert: create when no marker", () => {
  const r = dp.selectPrCommentUpsert([{ id: 1, body: "hello" }], dp.PR_MARKER_LINE);
  assert.deepEqual(r, { action: "create" });
});

test("selectPrCommentUpsert: update newest with marker", () => {
  const r = dp.selectPrCommentUpsert(
    [
      { id: 1, body: `old ${dp.PR_MARKER_LINE}` },
      { id: 2, body: "noise" },
      { id: 3, body: `newer ${dp.PR_MARKER_LINE}` },
    ],
    dp.PR_MARKER_LINE,
  );
  assert.deepEqual(r, { action: "update", id: 3 });
});

test("selectPrCommentUpsert: update when only legacy marker present", () => {
  const r = dp.selectPrCommentUpsert([{ id: 9, body: `x ${dp.PR_MARKER_LINE_LEGACY}` }], dp.PR_MARKER_LINE);
  assert.deepEqual(r, { action: "update", id: 9 });
});

test("render-discovery-ci.mjs summary prints golden", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts", "render-discovery-ci.mjs"), "summary"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, WFV_REPO_ROOT: root },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, dp.normalizeDiscoveryText(readFileSync(goldenSummary, "utf8")));
});

test("render-discovery-ci.mjs summary prints golden with AS_REPO_ROOT", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts", "render-discovery-ci.mjs"), "summary"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, AS_REPO_ROOT: root },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, dp.normalizeDiscoveryText(readFileSync(goldenSummary, "utf8")));
});

test("render-discovery-ci.mjs pr_body with empty files", () => {
  const dir = mkdtempSync(join(tmpdir(), "wfv-rd-"));
  const e = join(dir, "e.txt");
  const o = join(dir, "o.txt");
  writeFileSync(e, "", "utf8");
  writeFileSync(o, "", "utf8");
  try {
    const r = spawnSync(
      process.execPath,
      [
        join(root, "scripts", "render-discovery-ci.mjs"),
        "pr_body",
        "--stderr-file",
        e,
        "--workflow-stdout-file",
        o,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, WFV_REPO_ROOT: root } },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, readFileSync(goldenPr, "utf8"));
  } finally {
    unlinkSync(e);
    unlinkSync(o);
  }
});

test("render-discovery-ci.mjs exits 2 on bad argv", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts", "render-discovery-ci.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 2);
  assert.ok((r.stderr + r.stdout).toLowerCase().includes("usage") || r.stderr.includes("Usage"));
});

test("examples/github-actions/agentskeptic-commercial.yml governance workflow contract", () => {
  const ymlPath = join(root, "examples", "github-actions", "agentskeptic-commercial.yml");
  const yml = readFileSync(ymlPath, "utf8");
  assert.ok(yml.includes(dp.PR_MARKER_LINE));
  const doc = parseYaml(yml);
  assert.deepEqual(Object.keys(doc.jobs).sort(), [
    "governance_accept_dispatch",
    "governance_baseline",
    "governance_drift_pr",
  ]);
  assert.equal(
    doc.jobs.governance_baseline.if,
    "github.event_name == 'workflow_dispatch' && github.event.inputs.governance_job == 'baseline'",
  );
  assert.equal(doc.jobs.governance_drift_pr.if, "github.event_name == 'pull_request'");
  assert.equal(
    doc.jobs.governance_accept_dispatch.if,
    "github.event_name == 'workflow_dispatch' && github.event.inputs.governance_job == 'accept_drift'",
  );
  assert.deepEqual(Object.keys(doc.on.workflow_dispatch.inputs).sort(), [
    "acceptance_evidence_links_json",
    "acceptance_owner",
    "acceptance_reason",
    "acceptance_review_by",
    "expected_projection_hash",
    "governance_job",
    "lifecycle_state_version",
  ]);

  const blYaml = stringify(doc.jobs.governance_baseline);
  const prYaml = stringify(doc.jobs.governance_drift_pr);
  const adYaml = stringify(doc.jobs.governance_accept_dispatch);

  assert.equal((blYaml.match(/--create-baseline/g) || []).length, 1);
  assert.equal((blYaml.match(/--accept-drift/g) || []).length, 0);
  assert.equal((prYaml.match(/--create-baseline/g) || []).length, 0);
  assert.equal((prYaml.match(/--accept-drift/g) || []).length, 0);
  assert.equal((adYaml.match(/--create-baseline/g) || []).length, 0);
  assert.equal((adYaml.match(/--accept-drift/g) || []).length, 1);

  assert.ok(!/\bAGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH\b/.test(blYaml));
  assert.ok(!/\bAGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION\b/.test(blYaml));
  assert.ok(!/\bAGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH\b/.test(prYaml));
  assert.ok(!/\bAGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION\b/.test(prYaml));
  assert.ok(adYaml.includes("AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH"));
  assert.ok(adYaml.includes("AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION"));
});

test("examples/github-actions/agentskeptic-check.yml parses as OSS truth-check workflow", () => {
  const ymlPath = join(root, "examples", "github-actions", "agentskeptic-check.yml");
  const yml = readFileSync(ymlPath, "utf8");
  const pkgVer = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  assert.ok(
    !/\n\s+share-report-origin\s*:/m.test(yml),
    "OSS workflow must not include an uncommented share-report-origin input line (hosted publish stays opt-in)",
  );
  const doc = parseYaml(yml);
  assert.equal(doc.name, "AgentSkeptic Truth Check");
  assert.ok(yml.includes("./.github/actions/agentskeptic-check"));
  assert.ok(!/\bsecrets\./m.test(yml));
  assert.ok(!/\bAGENTSKEPTIC_API_KEY\s*:/m.test(yml));
  assert.ok(!yml.includes("agentskeptic enforce"));
  assert.ok(yml.includes("render-discovery-ci.mjs"));
  assert.ok(yml.includes("${AS_REPO_ROOT}"));
  assert.ok(yml.includes("npm install --no-save"));
  assert.ok(
    yml.includes(`AGENTSKEPTIC_CI_PACKAGE: agentskeptic@${pkgVer}`),
    `OSS workflow AGENTSKEPTIC_CI_PACKAGE must match root package.json version agentskeptic@${pkgVer}`,
  );
  assert.ok(
    !yml.includes("AGENTSKEPTIC_CI_PACKAGE: agentskeptic@latest"),
    "canonical OSS workflow must pin AGENTSKEPTIC_CI_PACKAGE to package.json semver, not latest",
  );
  assert.match(yml.trim(), /\bpackage:\s*\$\{\{\s*env\.AGENTSKEPTIC_CI_PACKAGE\s*\}\}/);

  const job = doc.jobs["truth-check"];
  assert.ok(Array.isArray(job?.steps));
  assert.strictEqual(job.name, "AgentSkeptic Truth Check");
  assert.strictEqual(job.env?.AGENTSKEPTIC_TELEMETRY, "0");
  assert.strictEqual(job.env?.AGENTSKEPTIC_CI_PACKAGE, `agentskeptic@${pkgVer}`);

  /** @type {any[]} */
  const steps = job.steps;
  let npmInstallCt = 0;
  let setupCt = 0;
  let sqliteCt = 0;
  let setupBeforeSqlite = false;
  for (const s of steps) {
    const run = typeof s?.run === "string" ? s.run : "";
    const uses = typeof s?.uses === "string" ? s.uses : "";
    const name = typeof s?.name === "string" ? s.name : "";
    if (run.includes("npm install --no-save")) npmInstallCt++;
    if (uses.includes("actions/setup-node")) setupCt++;
    if (run.includes("DatabaseSync") && name.includes("demo.db")) sqliteCt++;
  }
  assert.equal(npmInstallCt, 1, "OSS example uses exactly one npm install --no-save step");
  assert.equal(setupCt, 1, "OSS example uses exactly one actions/setup-node");
  assert.equal(sqliteCt, 1);
  /** @type {number[]} */
  const idxSetup = [];
  /** @type {number[]} */
  const idxSql = [];
  steps.forEach((s, i) => {
    const run = typeof s?.run === "string" ? s.run : "";
    const uses = typeof s?.uses === "string" ? s.uses : "";
    const name = typeof s?.name === "string" ? s.name : "";
    if (uses.includes("actions/setup-node")) idxSetup.push(i);
    if (run.includes("DatabaseSync") && name.includes("demo.db")) idxSql.push(i);
  });
  if (idxSetup.length === 1 && idxSql.length === 1 && idxSetup[0] < idxSql[0]) setupBeforeSqlite = true;
  assert.ok(setupBeforeSqlite, "setup-node step must precede demo.db SQLite creation");

  const compositeSteps = steps.filter((s) => s?.uses === "./.github/actions/agentskeptic-check");
  assert.equal(compositeSteps.length, 1, "OSS example must declare exactly one agentskeptic-check composite step");
  const withInputs = compositeSteps[0].with ?? {};
  assert.ok(
    !Object.hasOwn(withInputs, "share-report-origin"),
    "composite with: must omit share-report-origin on the default OSS path",
  );
  assert.strictEqual(withInputs.project, ".");
  assert.strictEqual(withInputs.package, "${{ env.AGENTSKEPTIC_CI_PACKAGE }}");
  assert.ok(!Object.hasOwn(withInputs, "events"));
  assert.ok(!Object.hasOwn(withInputs, "registry"));

  let shareEnv = false;
  for (const s of steps) {
    const env = s?.env;
    if (!env || typeof env !== "object") continue;
    if (env.INPUT_SHARE_REPORT_ORIGIN ?? env.SHARE_REPORT_ORIGIN) shareEnv = true;
  }
  assert.ok(!shareEnv, "OSS workflow steps must not set share-report-origin via env hacks");
});
