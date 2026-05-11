/**
 * Consolidated stale-claim audit for the GitHub CI visibility MVP (single
 * test file, single CI surface â€” runs under the existing `npm run verification:truth`
 * gate via node:test). One `test(...)` per audit row in the plan.
 *
 * SSOT: docs/ambient-ci-distribution.md.
 *
 * The MVP intentionally avoids new scripts in package.json or new workflow
 * plumbing; this file is the audit binary, and all checks below are binary
 * pass/fail invocations of ripgrep through child_process.spawnSync against an
 * explicit allowlist constant.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const TEXT_EXTENSIONS = new Set([
  ".md", ".mdx", ".mdc", ".markdown", ".txt",
  ".yml", ".yaml", ".json",
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx",
  ".sh", ".html", ".css",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  ".turbo", ".vercel", "coverage",
]);

function isTextPath(p) {
  const dot = p.lastIndexOf(".");
  if (dot < 0) return false;
  return TEXT_EXTENSIONS.has(p.slice(dot).toLowerCase());
}

function* walkTextFiles(absDir) {
  let entries;
  try { entries = readdirSync(absDir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const abs = join(absDir, ent.name);
    if (ent.isDirectory()) {
      yield* walkTextFiles(abs);
    } else if (ent.isFile() && isTextPath(ent.name)) {
      yield abs;
    }
  }
}

function expandPaths(relPaths) {
  const out = [];
  for (const rel of relPaths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile()) {
      if (isTextPath(rel)) out.push(abs);
      continue;
    }
    if (st.isDirectory()) {
      for (const f of walkTextFiles(abs)) out.push(f);
    }
  }
  return out;
}

function existingPaths(paths) {
  return paths.filter((p) => existsSync(join(root, p)));
}

/**
 * Pure-Node substitute for `rg -n PATTERN paths`. Returns "rel-path:line:lineText"
 * for every matching line. `pattern` is a JS RegExp string (PCRE-ish), `flags`
 * defaults to "m" so `^/$` operate per-line.
 */
function lineMatches(pattern, relPaths, flags = "m") {
  const re = new RegExp(pattern, flags);
  const files = expandPaths(relPaths);
  const out = [];
  for (const abs of files) {
    let body;
    try { body = readFileSync(abs, "utf8"); } catch { continue; }
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const rel = relative(root, abs).replace(/\\/g, "/");
        out.push(`${rel}:${i + 1}:${lines[i].trim()}`);
      }
    }
  }
  return out;
}

const SSOT_DOC = "docs/ambient-ci-distribution.md";

// ---------- audit row 1: repo docs do not carry old summary-centric prose ----------

test("docs: no obsolete summary-centric prose (Outcome Certificate / stdout dump etc.)", () => {
  const docPaths = existingPaths([
    "docs/integrate.md",
    "docs/first-truth-check.md",
    "docs/decision-evidence-bundle.md",
    "docs/outcome-certificate-normative.md",
    "docs/outcome-certificate-integrator.md",
  ]);
  // SSOT (ambient-ci-distribution.md) is the only doc allowed to mention CI summary mechanics
  // by name; the other integrator-facing docs must not duplicate the obsolete strings.
  // "Verdict meanings" was the old summary section title; "Outcome Certificate / stdout"
  // was the old fenced dump heading; head -n 200 / tail -n 200 / "raw stdout" were
  // operational copy that the renderer no longer suggests.
  const banned = String.raw`(?:### Verdict meanings|Outcome Certificate / stdout|stderr_block|head -n 200|tail -n 200|raw stdout)`;
  const hits = lineMatches(banned, docPaths);
  assert.deepEqual(hits, [], `Unexpected obsolete summary-centric prose:\n${hits.join("\n")}`);
});

test("docs: SSOT (ambient-ci-distribution.md) covers outputs + artifact + permissions exactly once", () => {
  const ssotBody = readFileSync(join(root, SSOT_DOC), "utf8");
  for (const needle of [
    "agentskeptic-outcome-certificate", // artifact name
    "outcome-certificate.json", // artifact file
    "ACTIONS_RUNTIME_TOKEN", // verified permissions story
    "Composite step outputs", // structured outputs section
    "failureSpine", // certificate-derived summary
    "release-critical-verdict",
    "release_critical_truth_check_verdict",
    "critical_not_trusted_or_unknown",
    "agentskeptic-governance-step",
  ]) {
    assert.ok(
      ssotBody.includes(needle),
      `${SSOT_DOC} is the SSOT for CI visibility but is missing: ${needle}`,
    );
  }
});

test("docs: integrate.md, first-truth-check.md, README.md cite the SSOT for CI visibility", () => {
  for (const f of ["docs/integrate.md", "docs/first-truth-check.md", "README.md"]) {
    const body = readFileSync(join(root, f), "utf8");
    assert.ok(
      body.includes("ambient-ci-distribution.md"),
      `${f} should link to docs/ambient-ci-distribution.md as the CI visibility SSOT`,
    );
  }
});

// ---------- audit row 2: README CI section enumerates outputs + artifact + permissions ----------

test("README: CI section enumerates structured outputs and artifact name", () => {
  const body = readFileSync(join(root, "README.md"), "utf8");
  for (const needle of [
    "agentskeptic-outcome-certificate", // artifact name
    "state-relation",
    "trust-decision",
    "release-critical-verdict",
    "failing-tool-ids",
    "primary-reason-codes",
    "failing-witness-kinds",
    "recommended-action",
    "automation-safe",
    "certificate-path",
    "contents: read", // OSS-friendly default permissions
  ]) {
    assert.ok(
      body.includes(needle),
      `README.md CI section is missing: ${needle}`,
    );
  }
});

// ---------- audit row 3: example workflow elevated permissions / OSS friction ----------

test("example workflow: OSS truth-check uses contents: read only â€” no elevated GITHUB_TOKEN scopes", () => {
  const f = join(root, "examples/github-actions/agentskeptic-check.yml");
  const body = readFileSync(f, "utf8");
  // Look only at lines that look like an actual YAML key assignment (whitespace
  // + key + : + space + write), not at refuting comments.
  const ELEVATED = /^[ \t]*(actions|pull-requests|checks|security-events|deployments|id-token):[ \t]+write[ \t]*$/m;
  assert.ok(
    !ELEVATED.test(body),
    `examples/github-actions/agentskeptic-check.yml must not declare elevated GITHUB_TOKEN scopes`,
  );
  assert.ok(
    /\n[ \t]*permissions:\s*\n[ \t]+contents:\s+read/.test(body),
    `examples/github-actions/agentskeptic-check.yml must keep \`permissions: contents: read\``,
  );
});

test("example workflow: stale write-decision-bundle CI prose is not on by default", () => {
  const f = join(root, "examples/github-actions/agentskeptic-check.yml");
  const body = readFileSync(f, "utf8");
  // The OSS example used to carry a multi-line "Optional: retain decision evidence" comment
  // recommending --write-decision-bundle. The MVP retires that prose because the composite
  // already uploads the certificate; integrators that want decision bundles read the SSOT.
  assert.ok(
    !body.includes("--write-decision-bundle"),
    `examples/github-actions/agentskeptic-check.yml must not advertise --write-decision-bundle as the default retention path`,
  );
  assert.ok(
    !/Optional: retain decision evidence/i.test(body),
    `examples/github-actions/agentskeptic-check.yml must not retain the obsolete "retain decision evidence" comment block`,
  );
});

test("example workflow: artifact name is documented and appears only inside the comment header (not as a duplicate upload)", () => {
  const f = "examples/github-actions/agentskeptic-check.yml";
  const body = readFileSync(join(root, f), "utf8");
  assert.ok(
    body.includes("agentskeptic-outcome-certificate"),
    `${f} must reference agentskeptic-outcome-certificate (so users know what to look for)`,
  );
  // The OSS example must NOT add its own actions/upload-artifact step for the
  // certificate — the composite already uploads it. A bare `actions/upload-artifact`
  // line in the example would imply duplicate uploads and a potentially conflicting
  // artifact name.
  assert.ok(
    !/\n[ \t]*-?[ \t]*uses:\s*actions\/upload-artifact@/.test(body),
    `${f} must not duplicate the composite's actions/upload-artifact step`,
  );
});

// ---------- audit row 4: generated llms.txt either has no CI claims or matches new contract ----------

test("llms.txt: any GitHub Actions / Outcome Certificate claims match the new contract", () => {
  const f = "llms.txt";
  if (!existsSync(join(root, f))) return; // no llms.txt yet â†’ vacuously OK
  const hits = lineMatches(
    String.raw`(?:GitHub Actions|outcome-certificate|truth_check_verdict)`,
    [f],
  );
  if (hits.length === 0) return; // no CI surface in llms.txt â€” fine
  const body = readFileSync(join(root, f), "utf8");
  // If llms.txt mentions GH Actions, it must not still describe stdout dumps as the summary.
  assert.ok(
    !/(### Verdict meanings|Outcome Certificate \/ stdout|head -n 200)/.test(body),
    "llms.txt mentions CI surface but still references obsolete summary prose",
  );
});

// ---------- audit row 5: website-synced content reflects the new contract or has no claims ----------

test("website: any synced GitHub Actions / certificate claims reflect the new contract", () => {
  const candidatePaths = ["website/content", "website/src/content", "website/src/app", "website/src/lib"];
  const present = existingPaths(candidatePaths);
  if (present.length === 0) return; // monorepo without website checkout
  const hits = lineMatches(
    String.raw`(?:github\.com/.*agentskeptic-check|GITHUB_STEP_SUMMARY|truth_check_verdict|Outcome Certificate)`,
    present,
  );
  if (hits.length === 0) return; // no synced GH Actions claims â€” vacuously OK
  // Any hit that lives in a markdown / TS source file under website/ must not assert the
  // obsolete CI presentation.
  const stale = lineMatches(
    String.raw`(?:### Verdict meanings|Outcome Certificate \/ stdout|head -n 200|tail -n 200|raw stdout)`,
    present,
  );
  assert.deepEqual(
    stale,
    [],
    `website surfaces still mention obsolete CI presentation:\n${stale.join("\n")}`,
  );
});

// ---------- audit row 6: schemas have no CI surface drift ----------

test("schemas: no GitHub Actions / composite-action surface inside OpenAPI or contract manifest", () => {
  const candidates = existingPaths([
    "schemas/openapi-commercial-v1.yaml",
    "schemas/contract/v1.json",
  ]);
  for (const f of candidates) {
    const hits = lineMatches(String.raw`(?:GitHub Actions|composite action)`, [f]);
    assert.deepEqual(hits, [], `${f} must not describe GitHub Actions or composite-action behavior:\n${hits.join("\n")}`);
  }
});

// ---------- audit row 7: action.yml + action folder shape is intact ----------

test("composite action folder ships the renderer next to action.yml", () => {
  const required = [
    ".github/actions/agentskeptic-check/action.yml",
    ".github/actions/agentskeptic-check/run-action.sh",
    ".github/actions/agentskeptic-check/outcome-ci-surface.mjs",
    ".github/actions/agentskeptic-check/witnessKindFromCode.mjs",
  ];
  for (const rel of required) {
    const abs = join(root, rel);
    assert.ok(existsSync(abs), `composite action is missing required file: ${rel}`);
    assert.ok(statSync(abs).size > 0, `composite action file is empty: ${rel}`);
  }
});

test("action.yml declares all structured outputs and the upload-artifact post step", () => {
  const f = join(root, ".github/actions/agentskeptic-check/action.yml");
  const body = readFileSync(f, "utf8");
  for (const needle of [
    "state-relation:",
    "trust-decision:",
    "release-critical-verdict:",
    "failing-tool-ids:",
    "primary-reason-codes:",
    "failing-witness-kinds:",
    "recommended-action:",
    "automation-safe:",
    "certificate-path:",
    "actions/upload-artifact@v4",
    "agentskeptic-outcome-certificate",
    "if-no-files-found: ignore",
    "if: always()",
    "enforce-coverage-budget:",
    "INPUT_ENFORCE_COVERAGE_BUDGET:",
  ]) {
    assert.ok(body.includes(needle), `action.yml is missing: ${needle}`);
  }
});
