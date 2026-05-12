#!/usr/bin/env node
// CI presentation SSOT for the AgentSkeptic composite action.
// Reads captured CLI stdout/stderr files, writes:
//   - $GITHUB_STEP_SUMMARY      (decision-grade markdown derived from Outcome Certificate v3)
//   - $GITHUB_OUTPUT            (structured action outputs)
//   - $RUNNER_TEMP/agentskeptic-ci/outcome-certificate.json (artifact source on parse success)
//
// Hard rule: this script never decides the bash exit code. The bash entry must
// derive the final exit code from CLI exit + fail-on BEFORE invoking this
// renderer, then exit with that value regardless of the renderer's status.

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { uniqueSortedWitnessKindsFromCodes } from "./witnessKindFromCode.mjs";

const STDERR_TAIL_LINES = 80;
const MAX_STDOUT_PARSE_BYTES = 262144; // 256 KiB cap; mirrors discovery-payload.lib.cjs guard.
const MAX_OUTPUT_VALUE_BYTES = 4096;
const MAX_PRIMARY_CODES = 24; // mirrors src/failureSpine.ts cap
const MAX_TOOL_IDS = 24;
const MAX_TABLE_ROWS = 32;
const RERUN_GUIDANCE_HARD_CAP = 512; // mirrors failure-spine schema rerunGuidance maxLength

/** Normalize path separators for markdown + GITHUB_OUTPUT (POSIX) — goldens stable on Windows vs Linux runners. */
function displayPathForCi(p) {
  return String(p).replace(/\\/g, "/");
}

// ---------- args ----------

function parseArgs(argv) {
  const out = {
    stdoutPath: "",
    stderrPath: "",
    cliExit: "",
    mode: "",
    verdict: "",
    artifactDir: "",
    githubOutput: process.env.GITHUB_OUTPUT || "",
    githubStepSummary: process.env.GITHUB_STEP_SUMMARY || "",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--stdout-file": out.stdoutPath = next; i++; break;
      case "--stderr-file": out.stderrPath = next; i++; break;
      case "--cli-exit": out.cliExit = next; i++; break;
      case "--mode": out.mode = next; i++; break;
      case "--verdict": out.verdict = next ?? ""; i++; break;
      case "--artifact-dir": out.artifactDir = next; i++; break;
      default: break;
    }
  }
  return out;
}

// ---------- io helpers ----------

function readFileSafe(path, max) {
  if (!path) return "";
  try {
    const st = statSync(path);
    if (max !== undefined && st.size > max) {
      // return marker; caller treats as oversized
      return null;
    }
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function utf8ByteLength(s) {
  return Buffer.byteLength(String(s), "utf8");
}

function tailLines(text, n) {
  const norm = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = norm.replace(/\n+$/, "").split("\n");
  if (lines.length === 1 && lines[0] === "") return [];
  return lines.slice(Math.max(0, lines.length - n));
}

function escapeTableCell(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function clampOutputValue(s) {
  const v = String(s);
  if (utf8ByteLength(v) <= MAX_OUTPUT_VALUE_BYTES) return v;
  // Truncate by bytes (utf8-safe enough for ASCII codes/IDs).
  let buf = Buffer.from(v, "utf8");
  buf = buf.subarray(0, MAX_OUTPUT_VALUE_BYTES - 12);
  return `${buf.toString("utf8")}…(truncated)`;
}

function writeOutputs(outputsMap, githubOutputPath) {
  if (!githubOutputPath) return;
  const lines = [];
  for (const [key, raw] of Object.entries(outputsMap)) {
    const v = clampOutputValue(raw);
    if (v.includes("\n") || v.includes("\r")) {
      // multiline-safe heredoc form per GitHub Actions docs
      const delim = `EOF_AS_${key}_${Math.random().toString(36).slice(2, 10)}`;
      lines.push(`${key}<<${delim}\n${v}\n${delim}`);
    } else {
      lines.push(`${key}=${v}`);
    }
  }
  if (lines.length > 0) {
    writeFileSync(githubOutputPath, lines.join("\n") + "\n", { flag: "a" });
  }
}

function appendSummary(text, githubStepSummaryPath) {
  if (!githubStepSummaryPath) return;
  writeFileSync(githubStepSummaryPath, text, { flag: "a" });
}

// ---------- certificate parsing ----------

function tryParseCertificate(stdoutText) {
  if (stdoutText === null) return { ok: false, reason: "oversized" };
  const t = String(stdoutText ?? "").trim();
  if (t.length === 0) return { ok: false, reason: "empty" };
  let obj;
  try {
    obj = JSON.parse(t);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!obj || typeof obj !== "object") return { ok: false, reason: "malformed" };
  if (obj.schemaVersion !== 3) return { ok: false, reason: "wrong_schema_version" };
  if (!obj.failureSpine || typeof obj.failureSpine !== "object") {
    return { ok: false, reason: "missing_failure_spine" };
  }
  return { ok: true, certificate: obj };
}

function tryParseCliErrorEnvelopeLines(stderrText) {
  const out = [];
  for (const raw of String(stderrText ?? "").split(/\r?\n/)) {
    const s = raw.trim();
    if (!s.startsWith("{")) continue;
    let obj;
    try { obj = JSON.parse(s); } catch { continue; }
    if (
      obj
      && typeof obj === "object"
      && obj.schemaVersion === 2
      && obj.kind === "execution_truth_layer_error"
      && obj.failureDiagnosis
      && typeof obj.failureDiagnosis === "object"
      && obj.failureDiagnosis.actionableFailure
    ) {
      out.push(obj);
    }
  }
  return out;
}

// ---------- table extraction from remediationItems / unverifiedClaims ----------

const STEP_FAILED_CHECK_RE = /^Failed check: step (\d+)(?:\s*\(([^)]+)\))?/;
const EFFECT_FAILED_CHECK_RE = /^Failed check: effect (.+) on step (\d+)/;
const UNVERIFIED_CLAIM_RE = /^([^:]*):seq=(\d+):\s*(.*)$/;

function extractFailingStepRowsFromCertificate(cert) {
  const ec = cert.evidenceCompleteness ?? {};
  const items = Array.isArray(ec.remediationItems) ? ec.remediationItems : [];
  const rows = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const scope = item.scope;
    if (scope !== "step" && scope !== "effect") continue;
    const failedCheck = String(item.failedCheck || "");
    const codes = Array.isArray(item.reasonCodes) ? item.reasonCodes.slice(0, 4) : [];
    if (scope === "step") {
      const m = failedCheck.match(STEP_FAILED_CHECK_RE);
      if (m) {
        rows.push({
          scope: "step",
          seq: m[1],
          toolId: m[2] ?? "",
          target: "",
          reasonCodes: codes,
          actionText: String(item.actionText || ""),
        });
        continue;
      }
      // best-effort even if pattern unexpected
      rows.push({
        scope: "step", seq: "?", toolId: "", target: "",
        reasonCodes: codes, actionText: String(item.actionText || ""),
      });
    } else {
      const m = failedCheck.match(EFFECT_FAILED_CHECK_RE);
      if (m) {
        rows.push({
          scope: "effect",
          seq: m[2],
          toolId: "",
          target: m[1],
          reasonCodes: codes,
          actionText: String(item.actionText || ""),
        });
        continue;
      }
      rows.push({
        scope: "effect", seq: "?", toolId: "", target: "",
        reasonCodes: codes, actionText: String(item.actionText || ""),
      });
    }
  }

  if (rows.length > 0) return { rows: rows.slice(0, MAX_TABLE_ROWS), source: "remediationItems" };

  // Fallback to unverifiedClaims (toolId:seq=N: message) when remediation enrichment is absent
  const claims = Array.isArray(ec.unverifiedClaims) ? ec.unverifiedClaims : [];
  const fallback = [];
  for (const claim of claims) {
    const m = String(claim || "").match(UNVERIFIED_CLAIM_RE);
    if (!m) continue;
    fallback.push({
      scope: "step",
      seq: m[2],
      toolId: m[1],
      target: "",
      reasonCodes: [],
      actionText: m[3],
    });
    if (fallback.length >= MAX_TABLE_ROWS) break;
  }
  return { rows: fallback, source: fallback.length > 0 ? "unverifiedClaims" : "none" };
}

function failingToolIdsFromCertificate(cert, rows) {
  const set = new Set();
  for (const r of rows) {
    if (r.toolId && r.toolId.length > 0) set.add(r.toolId);
  }
  // Augment from explicit certificate.steps where outcome != VERIFIED — but
  // OutcomeCertificateStep does not carry status; defer to remediation rows + unverified claims.
  return [...set].sort((a, b) => a.localeCompare(b)).slice(0, MAX_TOOL_IDS);
}

function failingReasonCodeSetFromCertificate(cert, rows) {
  const set = new Set();
  // Primary codes from spine first
  if (Array.isArray(cert.failureSpine?.primaryCodes)) {
    for (const c of cert.failureSpine.primaryCodes) {
      if (typeof c === "string" && c.length > 0) set.add(c);
    }
  }
  // Augment with row-level reason codes (kept narrow for witness derivation)
  for (const r of rows) {
    for (const c of r.reasonCodes ?? []) {
      if (typeof c === "string" && c.length > 0) set.add(c);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b)).slice(0, MAX_PRIMARY_CODES);
}

// ---------- summary markdown sections ----------

function fmtVerdictLine({ verdict, cert }) {
  const stateRelation = cert?.stateRelation ?? "";
  const reliance = cert?.highStakesReliance ?? "";
  const releaseCritical = cert?.releaseCriticalVerdict ?? "";
  const parts = [];
  parts.push(`- truth_check_verdict: \`${verdict || "unavailable"}\``);
  if (releaseCritical) {
    parts.push(`- release_critical_truth_check_verdict: \`${releaseCritical}\``);
  }
  if (stateRelation) parts.push(`- state_relation: \`${stateRelation}\``);
  if (reliance) parts.push(`- high_stakes_reliance: \`${reliance}\``);
  return parts.join("\n");
}

function fmtReleaseCriticalGate(cert) {
  const v = cert?.releaseCriticalVerdict ?? "";
  return [
    "### Release-critical gate",
    "",
    `- release_critical_truth_check_verdict: \`${v || "unavailable"}\``,
  ].join("\n");
}

function fmtSpineBlock(spine) {
  const af = spine.actionableFailure ?? {};
  const codes = Array.isArray(spine.primaryCodes) ? spine.primaryCodes.join(",") : "";
  const lines = [
    "### Failure spine",
    "",
    `- trust_decision: \`${spine.trustDecision ?? ""}\``,
    `- summary: ${oneLine(spine.summary ?? "")}`,
    `- actionable_failure: category=\`${af.category ?? ""}\` severity=\`${af.severity ?? ""}\` recommended_action=\`${af.recommendedAction ?? ""}\` automation_safe=\`${af.automationSafe === true ? "true" : "false"}\``,
    `- primary_codes: ${codes ? `\`${codes}\`` : "_(none)_"}`,
    `- rerun_guidance: ${oneLine(truncateString(spine.rerunGuidance ?? "", RERUN_GUIDANCE_HARD_CAP))}`,
    `- source: \`${spine.source ?? ""}\``,
  ];
  return lines.join("\n");
}

function fmtFailingStepsTable(rows) {
  if (rows.length === 0) {
    return "### Failing steps\n\n_(no failing steps)_\n";
  }
  const out = [
    "### Failing steps",
    "",
    "| seq | scope | tool / effect | reason codes | recommended action |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const target = r.scope === "effect"
      ? `effect: ${escapeTableCell(r.target || "(unnamed)")}`
      : escapeTableCell(r.toolId || "(no tool id)");
    const codes = r.reasonCodes && r.reasonCodes.length > 0
      ? r.reasonCodes.map((c) => `\`${escapeTableCell(c)}\``).join(", ")
      : "_(none)_";
    const action = r.actionText
      ? escapeTableCell(truncateString(r.actionText, 200))
      : "_(none)_";
    out.push(
      `| ${escapeTableCell(r.seq)} | ${escapeTableCell(r.scope)} | ${target} | ${codes} | ${action} |`,
    );
  }
  return out.join("\n");
}

function fmtCheckpointVerdicts(cert) {
  const cps = Array.isArray(cert.checkpointVerdicts) ? cert.checkpointVerdicts : [];
  if (cps.length === 0) return "";
  const out = [
    "### LangGraph checkpoint verdicts",
    "",
    "| checkpoint | verdict | seqs | production meaning |",
    "| --- | --- | --- | --- |",
  ];
  for (const cp of cps) {
    out.push(
      `| ${escapeTableCell(cp.checkpointKey)} | \`${escapeTableCell(cp.verdict)}\` | ${escapeTableCell((cp.seqs ?? []).join(","))} | ${escapeTableCell(cp.productionMeaning ?? "")} |`,
    );
  }
  return out.join("\n");
}

function fmtWitnessKinds(witnessKinds) {
  if (witnessKinds.length === 0) return "- failing_witness_kinds: _(none)_";
  return `- failing_witness_kinds: ${witnessKinds.map((k) => `\`${k}\``).join(", ")}`;
}

function fmtCanonicalKindList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "_(none)_";
  return arr.map((k) => `\`${escapeTableCell(String(k))}\``).join(", ");
}

/**
 * Authoritative exercised / satisfied modalities from certificate JSON (Slice 1 SSOT).
 */
function fmtWitnessCoverage(cert) {
  const ec = cert.evidenceCompleteness ?? {};
  const wc = ec.witnessCoverage;
  if (!wc || typeof wc !== "object") {
    return [
      "### Witness coverage",
      "",
      "- _(witness coverage omitted — rerun with current CLI)_",
      "",
    ].join("\n");
  }
  const exercised = fmtCanonicalKindList(wc.exercisedKinds);
  const full = fmtCanonicalKindList(wc.fullySatisfiedKinds);
  const bad = fmtCanonicalKindList(wc.notFullySatisfiedKinds);
  const label = typeof wc.supportLabel === "string" ? wc.supportLabel : "";
  const lines = [
    "### Witness coverage",
    "",
    `- exercised_modalities: ${exercised}`,
    `- fully_satisfied_modalities: ${full}`,
    `- not_fully_satisfied_modalities: ${bad}`,
    `- support_label: \`${escapeTableCell(label)}\``,
  ];
  if (typeof wc.summaryLine === "string" && wc.summaryLine.length > 0) {
    lines.push(`- summary: ${oneLine(truncateString(wc.summaryLine, 400))}`);
  }
  lines.push(
    "",
    "> `failing_witness_kinds` below is derived only from **failing** reason-code prefixes (legacy GitHub Actions output). It is **not** the same as modalities exercised on trusted runs.",
    "",
  );
  return lines.join("\n");
}

function fmtCoverageSnapshot(cert) {
  const ec = cert.evidenceCompleteness ?? {};
  const checked = Array.isArray(ec.verifiedClaims) ? ec.verifiedClaims.length : 0;
  const notChecked = Array.isArray(ec.unverifiedClaims) ? ec.unverifiedClaims.length : 0;
  const missing = Array.isArray(ec.missingInputs) ? ec.missingInputs.length : 0;
  return [
    "### Coverage snapshot (claim counts; not modality coverage)",
    "",
    `- checked_claims_count: \`${checked}\``,
    `- not_checked_claims_count: \`${notChecked}\``,
    `- missing_inputs_count: \`${missing}\``,
  ].join("\n");
}

function fmtArtifactBlock(artifactWritten, artifactPath) {
  if (!artifactWritten) {
    return [
      "### Outcome Certificate artifact",
      "",
      "_(not uploaded — stdout did not parse as Outcome Certificate v3)_",
    ].join("\n");
  }
  return [
    "### Outcome Certificate artifact",
    "",
    "Download the canonical certificate from this run's **Artifacts** list:",
    "",
    "- name: `agentskeptic-outcome-certificate`",
    "- file: `outcome-certificate.json`",
    `- written-to: \`${artifactPath}\``,
  ].join("\n");
}

function fmtStderrDetails(stderrText) {
  const tail = tailLines(stderrText, STDERR_TAIL_LINES);
  if (tail.length === 0) {
    return "<details><summary>CLI stderr (last 80 lines)</summary>\n\n_(no stderr)_\n\n</details>";
  }
  return [
    "<details><summary>CLI stderr (last 80 lines)</summary>",
    "",
    "```text",
    tail.join("\n"),
    "```",
    "",
    "</details>",
  ].join("\n");
}

function fmtOperationalBlock(reason, envelopes) {
  const lines = [
    "### Operational presentation (no certificate)",
    "",
    `- reason: \`${reason}\``,
    "- The CLI did not emit a parseable Outcome Certificate v3 on stdout.",
    "- This summary therefore omits trust spine, failing-steps table, and artifact upload.",
  ];
  if (envelopes.length > 0) {
    for (const env of envelopes) {
      const fd = env.failureDiagnosis ?? {};
      const af = fd.actionableFailure ?? {};
      lines.push("");
      lines.push("**CLI error envelope**");
      lines.push("");
      lines.push(`- code: \`${env.code ?? ""}\``);
      lines.push(`- message: ${oneLine(env.message ?? "")}`);
      lines.push(`- summary: ${oneLine(fd.summary ?? "")}`);
      lines.push(
        `- actionable_failure: category=\`${af.category ?? ""}\` severity=\`${af.severity ?? ""}\` recommended_action=\`${af.recommendedAction ?? ""}\` automation_safe=\`${af.automationSafe === true ? "true" : "false"}\``,
      );
    }
  }
  return lines.join("\n");
}

function oneLine(s) {
  return String(s ?? "").replace(/\r\n|\r|\n/g, " ").replace(/ +/g, " ").trim();
}
function truncateString(s, max) {
  const v = String(s ?? "");
  if (v.length <= max) return v;
  return v.slice(0, Math.max(0, max - 1)) + "…";
}

// ---------- enforce / governance (commercial CI) ----------

const LITERAL_NEXT_MALFORMED_OUTER =
  "Malformed enforce stdout: expected one JSON line object with top-level schemaVersion 2 and enforce object.";
const LITERAL_NEXT_UNKNOWN_INNER =
  "Unknown enforcement envelope shape; open docs/ci-enforcement.md and compare stdout to hosted POST /check|baselines|accept 200 bodies.";
const LITERAL_NEXT_OVERSIZED =
  "Fix stdout capture; expected one JSON line `{schemaVersion:2,enforce:{…}}`.";

/** Sorted lexicographically — goldens stable. */
const GOVERNANCE_OUTPUT_KEYS = [
  "agentskeptic-governance-accept-available",
  "agentskeptic-governance-decision-reason-code",
  "agentskeptic-governance-expected-projection-hash-for-accept",
  "agentskeptic-governance-lifecycle-state",
  "agentskeptic-governance-lifecycle-state-version",
  "agentskeptic-governance-next-action",
  "agentskeptic-governance-pass-kind",
  "agentskeptic-governance-result-status",
  "agentskeptic-governance-step",
].sort((a, b) => a.localeCompare(b));

const EMPTY_CERT_OUTPUTS = {
  "state-relation": "",
  "trust-decision": "",
  "release-critical-verdict": "",
  "failing-tool-ids": "",
  "primary-reason-codes": "",
  "failing-witness-kinds": "",
  "recommended-action": "",
  "automation-safe": "",
  "certificate-path": "",
};

function emptyGovernanceOutputMap() {
  /** @type {Record<string, string>} */
  const m = {};
  for (const k of GOVERNANCE_OUTPUT_KEYS) m[k] = "";
  return m;
}

function mergeOutputs(certOutputs, govMap) {
  const out = { ...certOutputs };
  for (const k of GOVERNANCE_OUTPUT_KEYS) {
    out[k] = govMap[k] ?? "";
  }
  return out;
}

function tryParseEnforceOuter(stdoutText) {
  const t = String(stdoutText ?? "").trim();
  if (t.length === 0) return { ok: false, reason: "malformed_outer" };
  let obj;
  try {
    obj = JSON.parse(t);
  } catch {
    return { ok: false, reason: "malformed_outer" };
  }
  if (!obj || typeof obj !== "object") return { ok: false, reason: "malformed_outer" };
  if (obj.schemaVersion !== 2) return { ok: false, reason: "malformed_outer" };
  if (!obj.enforce || typeof obj.enforce !== "object") return { ok: false, reason: "malformed_outer" };
  return { ok: true, inner: obj.enforce };
}

function classifyEnforceInner(inner) {
  if (!inner || inner.schema_version !== 2 || typeof inner.code !== "string") return { kind: "unknown" };
  if (typeof inner.accepted_projection_hash === "string" && inner.accepted_projection_hash.length > 0) {
    return { kind: "v3", inner };
  }
  const code = inner.code;
  const rs = inner.result_status;
  if (code === "COMPLETED" && typeof rs === "string" && rs.length > 0) return { kind: "v1", inner };
  if (
    code === "COMPLETED"
    && inner.decision_reason_code === "BASELINE_ESTABLISHED"
    && (rs === undefined || rs === null || rs === "")
  ) {
    return { kind: "v2", inner };
  }
  return { kind: "unknown" };
}

function pinAcceptString(inner) {
  const v = inner?.expected_projection_hash_for_accept;
  return typeof v === "string" && v.length > 0 ? v : "";
}

function smallestNextActionForStep(step) {
  switch (step) {
    case "STEADY_OK":
      return "Continue recurring `enforce` checks on PRs/default branch.";
    case "ACCEPT_DRIFT_PINNED":
      return "Set `AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH` and `AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION` from table pins; run `agentskeptic enforce … --accept-drift`; then rerun steady `enforce` check.";
    case "DRIFT_NO_PIN":
      return "Drift without accept pin—follow `next_action` from API and docs/ci-enforcement.md.";
    case "RERUN_PASS":
      return "Governance posture restored; resume steady checks.";
    case "RERUN_FAIL":
      return "Rerun still mismatched; reconcile evidence or follow accept path if pins present.";
    case "BASELINE_CREATED":
      return "Baseline established; switch CI to steady `enforce` without `--create-baseline`.";
    case "ACCEPT_RECORDED_RERUN_CHECK":
      return "Accept recorded; run steady `enforce` check to return to trusted posture.";
    case "MALFORMED_ENVELOPE":
    case "OVERSIZED_STDOUT":
      return "Fix stdout capture; expected one JSON line `{schemaVersion:2,enforce:{…}}`.";
    case "HOSTED_OR_USAGE_ERROR":
      return "Fix API key, reserve, or server error; see stderr `cliErrorEnvelope`.";
    case "VERIFY_INCOMPLETE":
      return "Governance POST returned 2xx; local verify outcome incomplete—fix events/registry/db inputs and rerun `agentskeptic enforce`.";
    default:
      return "";
  }
}

function firstLineOfNextAction(inner) {
  const na = inner?.next_action;
  if (typeof na !== "string" || !na.trim()) return "";
  return na.split(/\r?\n/)[0].trim();
}

function clampUtf16Json(inner, maxUnits) {
  const raw = JSON.stringify(inner);
  let out = "";
  let u = 0;
  for (const ch of raw) {
    if (u >= maxUnits) return `${out}…`;
    out += ch;
    u++;
  }
  return out;
}

function hostedErrorNextAction(stderrText) {
  const envs = tryParseCliErrorEnvelopeLines(stderrText || "");
  if (envs.length === 0) return "Operational failure (see stderr).";
  return oneLine(envs[0].message || envs[0].failureDiagnosis?.summary || "Operational failure (see stderr).");
}

function resolveV1Step(inner, cli) {
  const rs = String(inner.result_status || "");
  const pin = pinAcceptString(inner);
  if (rs === "drift" && pin && cli === 4) return "ACCEPT_DRIFT_PINNED";
  if (rs === "drift" && !pin) return "DRIFT_NO_PIN";
  if (rs === "match" && cli === 0) return "STEADY_OK";
  if (rs === "rerun_pass" && cli === 0) return "RERUN_PASS";
  if (rs === "rerun_fail" && cli === 4) return "RERUN_FAIL";
  if (rs === "match") return "STEADY_OK";
  return "DRIFT_NO_PIN";
}

function resolveEnforceOperatorStep(stdoutText, stderrText, cliExitNum) {
  if (stdoutText === null) {
    return {
      step: "OVERSIZED_STDOUT",
      malformedKind: null,
      inner: null,
      classification: null,
      outerOk: false,
    };
  }
  const trimmed = String(stdoutText ?? "").trim();
  if (trimmed === "" && cliExitNum === 3) {
    return {
      step: "HOSTED_OR_USAGE_ERROR",
      malformedKind: null,
      inner: null,
      classification: null,
      outerOk: false,
    };
  }

  const outer = tryParseEnforceOuter(stdoutText);
  if (!outer.ok) {
    return {
      step: "MALFORMED_ENVELOPE",
      malformedKind: "outer",
      inner: null,
      classification: null,
      outerOk: false,
    };
  }

  const classification = classifyEnforceInner(outer.inner);
  if (classification.kind === "unknown") {
    return {
      step: "MALFORMED_ENVELOPE",
      malformedKind: "unknown_inner",
      inner: outer.inner,
      classification,
      outerOk: true,
    };
  }

  if (cliExitNum === 3) {
    return {
      step: "HOSTED_OR_USAGE_ERROR",
      malformedKind: null,
      inner: outer.inner,
      classification,
      outerOk: true,
    };
  }

  if ((cliExitNum === 1 || cliExitNum === 2) && (classification.kind === "v1" || classification.kind === "v2" || classification.kind === "v3")) {
    return {
      step: "VERIFY_INCOMPLETE",
      malformedKind: null,
      inner: outer.inner,
      classification,
      outerOk: true,
    };
  }

  if (classification.kind === "v1") {
    return {
      step: resolveV1Step(outer.inner, cliExitNum),
      malformedKind: null,
      inner: outer.inner,
      classification,
      outerOk: true,
    };
  }
  if (classification.kind === "v2") {
    return { step: "BASELINE_CREATED", malformedKind: null, inner: outer.inner, classification, outerOk: true };
  }
  return { step: "ACCEPT_RECORDED_RERUN_CHECK", malformedKind: null, inner: outer.inner, classification, outerOk: true };
}

function buildGovernanceOutputMap(resolved, stderrText) {
  const m = emptyGovernanceOutputMap();
  const step = resolved.step;
  m["agentskeptic-governance-step"] = step;

  if (step === "OVERSIZED_STDOUT") {
    m["agentskeptic-governance-next-action"] = LITERAL_NEXT_OVERSIZED;
    m["agentskeptic-governance-accept-available"] = "false";
    return m;
  }
  if (step === "MALFORMED_ENVELOPE" && resolved.malformedKind === "outer") {
    m["agentskeptic-governance-next-action"] = LITERAL_NEXT_MALFORMED_OUTER;
    m["agentskeptic-governance-accept-available"] = "false";
    return m;
  }
  if (step === "MALFORMED_ENVELOPE" && resolved.malformedKind === "unknown_inner") {
    m["agentskeptic-governance-next-action"] = LITERAL_NEXT_UNKNOWN_INNER;
    m["agentskeptic-governance-accept-available"] = "false";
    const c = resolved.inner?.code;
    m["agentskeptic-governance-decision-reason-code"] = typeof c === "string" ? c : "";
    return m;
  }
  if (step === "HOSTED_OR_USAGE_ERROR") {
    m["agentskeptic-governance-next-action"] = hostedErrorNextAction(stderrText);
    m["agentskeptic-governance-accept-available"] = "false";
    return m;
  }

  const inner = resolved.inner;
  if (!inner) {
    m["agentskeptic-governance-next-action"] = smallestNextActionForStep(step);
    m["agentskeptic-governance-accept-available"] = "false";
    return m;
  }

  const pin = pinAcceptString(inner);
  m["agentskeptic-governance-accept-available"] = pin.length > 0 ? "true" : "false";
  m["agentskeptic-governance-expected-projection-hash-for-accept"] = pin;
  m["agentskeptic-governance-lifecycle-state"] = typeof inner.lifecycle_state === "string" ? inner.lifecycle_state : "";
  m["agentskeptic-governance-lifecycle-state-version"] =
    inner.lifecycle_state_version !== undefined && inner.lifecycle_state_version !== null
      ? String(inner.lifecycle_state_version)
      : "";

  if (resolved.classification?.kind === "v2" || resolved.classification?.kind === "v3") {
    m["agentskeptic-governance-result-status"] = "";
    m["agentskeptic-governance-decision-reason-code"] =
      typeof inner.decision_reason_code === "string" ? inner.decision_reason_code : "";
  } else {
    m["agentskeptic-governance-result-status"] = typeof inner.result_status === "string" ? inner.result_status : "";
    m["agentskeptic-governance-decision-reason-code"] =
      typeof inner.decision_reason_code === "string" ? inner.decision_reason_code : "";
  }

  const fl = firstLineOfNextAction(inner);
  m["agentskeptic-governance-next-action"] = fl || smallestNextActionForStep(step);
  m["agentskeptic-governance-pass-kind"] = typeof inner.pass_kind === "string" ? inner.pass_kind : "";

  return m;
}

function fmtGovernanceTable(resolved, govMap, cliExitStr) {
  const step = resolved.step;
  const inner = resolved.inner;
  const rs =
    inner && typeof inner.result_status === "string" && inner.result_status.length > 0
      ? inner.result_status
      : "n/a";
  const drift =
    rs === "match" || rs === "rerun_pass" ? "no"
    : rs === "drift" || rs === "rerun_fail" ? "yes"
    : "n/a";
  const accept = govMap["agentskeptic-governance-accept-available"] || "false";
  const pin = govMap["agentskeptic-governance-expected-projection-hash-for-accept"] || "";
  const accepted =
    inner && typeof inner.accepted_projection_hash === "string" && inner.accepted_projection_hash.length > 0
      ? inner.accepted_projection_hash
      : "";
  const pinsCol =
    accepted
      ? `accepted:\`${escapeTableCell(accepted)}\` / v${escapeTableCell(govMap["agentskeptic-governance-lifecycle-state-version"] || "")}`
      : pin
        ? `\`${escapeTableCell(pin)}\` / v${escapeTableCell(govMap["agentskeptic-governance-lifecycle-state-version"] || "")}`
        : `— / v${escapeTableCell(govMap["agentskeptic-governance-lifecycle-state-version"] || "")}`;
  const lc = govMap["agentskeptic-governance-lifecycle-state"] || "";
  const next = govMap["agentskeptic-governance-next-action"] || smallestNextActionForStep(step);

  const lines = [
    "### Governance (enforce)",
    "",
    "| Governance outcome | Drift | Accept available | Pins / lifecycle_version | Lifecycle state | Smallest next action |",
    "| --- | --- | --- | --- | --- | --- |",
    `| \`${escapeTableCell(step)}\` | \`${drift}\` | \`${accept}\` | ${pinsCol} | \`${escapeTableCell(lc)}\` | ${escapeTableCell(next)} |`,
    "",
  ];

  if (step === "VERIFY_INCOMPLETE") {
    lines.push("**Verification incomplete (governance POST ok, verify exit non-zero)**", "");
    lines.push(`CLI exit ${escapeTableCell(String(cliExitStr || "0"))} — fix verification inputs, then rerun enforce.`, "");
  }

  if (step === "MALFORMED_ENVELOPE" && resolved.malformedKind === "outer") {
    lines.push("- `operator_step`: `MALFORMED_ENVELOPE`", "- `reason`: `malformed_stdout`", "");
  }

  if (step === "MALFORMED_ENVELOPE" && resolved.malformedKind === "unknown_inner" && inner) {
    lines.push("- `operator_step`: `MALFORMED_ENVELOPE`", `- inner.code: \`${escapeTableCell(String(inner.code ?? ""))}\``, "", "```json", clampUtf16Json(inner, 4000), "```", "");
  }

  lines.push("**Smallest next action (operator copy)**", "", smallestNextActionForStep(step), "");

  return lines.join("\n");
}

function runEnforcePresentation(args, stdoutText, stderrText) {
  const cliExitNum = Number.parseInt(String(args.cliExit || "0"), 10);
  const cliSafe = Number.isFinite(cliExitNum) ? cliExitNum : 0;
  const resolved = resolveEnforceOperatorStep(stdoutText, stderrText, cliSafe);
  const govMap = buildGovernanceOutputMap(resolved, stderrText);

  const summaryHeader = [
    "## AgentSkeptic truth check",
    "",
    `- mode: \`${args.mode || "check"}\``,
    `- cli_exit: \`${args.cliExit || "0"}\``,
    "",
  ].join("\n");

  const govBlock = fmtGovernanceTable(resolved, govMap, args.cliExit || "0");
  const sections = [summaryHeader, govBlock];

  if (resolved.step === "OVERSIZED_STDOUT") {
    sections.push(fmtOperationalBlock("oversized", []));
  } else if (resolved.step === "MALFORMED_ENVELOPE" && resolved.malformedKind === "outer") {
    sections.push(fmtOperationalBlock("malformed", tryParseCliErrorEnvelopeLines(stderrText || "")));
  }

  sections.push(fmtArtifactBlock(false, ""));
  sections.push(fmtStderrDetails(stderrText || ""));
  sections.push("");

  const summary = sections.join("\n");
  const outputs = mergeOutputs({ ...EMPTY_CERT_OUTPUTS }, govMap);
  return { summary, outputs, artifactWritten: false };
}

// ---------- main ----------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stdoutPath || !args.stderrPath) {
    console.error("outcome-ci-surface: --stdout-file and --stderr-file are required");
    process.exit(2);
  }

  const stdoutText = readFileSafe(args.stdoutPath, MAX_STDOUT_PARSE_BYTES);
  const stderrText = readFileSafe(args.stderrPath);

  const mode = String(args.mode || "check").trim();
  if (mode === "enforce") {
    const { summary, outputs } = runEnforcePresentation(args, stdoutText, stderrText);
    appendSummary(summary, args.githubStepSummary);
    writeOutputs(outputs, args.githubOutput);
    return;
  }

  const oversized = stdoutText === null;
  const parseRes = oversized
    ? { ok: false, reason: "oversized" }
    : tryParseCertificate(stdoutText);

  // Always-empty defaults; certificate runs overwrite below.
  const outputs = {
    "state-relation": "",
    "trust-decision": "",
    "release-critical-verdict": "",
    "failing-tool-ids": "",
    "primary-reason-codes": "",
    "failing-witness-kinds": "",
    "recommended-action": "",
    "automation-safe": "",
    "certificate-path": "",
  };

  let summary = "";
  let artifactWritten = false;
  let artifactPath = "";

  const summaryHeader = [
    "## AgentSkeptic truth check",
    "",
    `- mode: \`${args.mode || "check"}\``,
    `- cli_exit: \`${args.cliExit || "0"}\``,
  ].join("\n");

  if (parseRes.ok) {
    const cert = parseRes.certificate;
    const spine = cert.failureSpine;

    // Verdict / cert state coherence guard
    let warningLine = "";
    const verdict = (args.verdict || "").trim();
    const stateRel = cert.stateRelation;
    const verdictMatch =
      (verdict === "trusted" && stateRel === "matches_expectations")
      || (verdict === "not_trusted" && stateRel === "does_not_match")
      || (verdict === "unknown" && stateRel === "not_established")
      || verdict === ""; // CLI did not emit verdict line
    if (!verdictMatch) {
      warningLine = `::warning::agentskeptic-check: stderr verdict '${verdict}' disagrees with certificate stateRelation '${stateRel}'`;
      console.error(warningLine);
    }

    // Artifact write
    const dir = args.artifactDir
      || join(process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp", "agentskeptic-ci");
    mkdirSync(dir, { recursive: true });
    artifactPath = join(dir, "outcome-certificate.json");
    writeFileSync(artifactPath, JSON.stringify(cert, null, 2));
    artifactWritten = true;
    const artifactPathDisplay = displayPathForCi(artifactPath);

    // Rows + derived fields
    const tableRes = extractFailingStepRowsFromCertificate(cert);
    const rows = tableRes.rows;
    const failingToolIds = failingToolIdsFromCertificate(cert, rows);
    const codeSet = failingReasonCodeSetFromCertificate(cert, rows);
    const witnessKinds =
      cert.stateRelation === "matches_expectations"
        ? []
        : uniqueSortedWitnessKindsFromCodes(codeSet);

    outputs["state-relation"] = String(cert.stateRelation || "");
    outputs["trust-decision"] = String(spine.trustDecision || "");
    outputs["release-critical-verdict"] = String(cert.releaseCriticalVerdict || "");
    outputs["failing-tool-ids"] = failingToolIds.join(",");
    outputs["primary-reason-codes"] = (
      Array.isArray(spine.primaryCodes) ? spine.primaryCodes.slice(0, MAX_PRIMARY_CODES) : []
    ).join(",");
    outputs["failing-witness-kinds"] = witnessKinds.join(",");
    outputs["recommended-action"] = String(spine.actionableFailure?.recommendedAction || "");
    outputs["automation-safe"] = spine.actionableFailure?.automationSafe === true ? "true" : "false";
    outputs["certificate-path"] = artifactPathDisplay;

    const sections = [
      summaryHeader,
      "",
      fmtVerdictLine({ verdict, cert }),
      "",
      fmtReleaseCriticalGate(cert),
    ];
    if (warningLine) {
      sections.push("");
      sections.push(`> :warning: ${warningLine.replace(/^::warning::/, "")}`);
    }
    sections.push("", fmtSpineBlock(spine));
    sections.push("", fmtFailingStepsTable(rows));
    sections.push("", fmtCoverageSnapshot(cert));
    sections.push("", fmtWitnessCoverage(cert));
    sections.push("", fmtWitnessKinds(witnessKinds));
    const cps = fmtCheckpointVerdicts(cert);
    if (cps) sections.push("", cps);
    sections.push("", fmtArtifactBlock(true, artifactPathDisplay));
    sections.push("", fmtStderrDetails(stderrText || ""));
    sections.push("");
    summary = sections.join("\n");
  } else {
    const envelopes = tryParseCliErrorEnvelopeLines(stderrText || "");
    const sections = [
      summaryHeader,
      "",
      `- truth_check_verdict: \`${args.verdict || "unavailable"}\``,
      "- release_critical_truth_check_verdict: `unavailable`",
      "",
      fmtOperationalBlock(parseRes.reason, envelopes),
      "",
      fmtArtifactBlock(false, ""),
      "",
      fmtStderrDetails(stderrText || ""),
      "",
    ];
    summary = sections.join("\n");
  }

  appendSummary(summary, args.githubStepSummary);
  writeOutputs(outputs, args.githubOutput);
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error(`::warning::agentskeptic-check: outcome-ci-surface threw: ${err && err.message ? err.message : String(err)}`);
  // Never let this script alter exit semantics; run-action.sh ignores this code anyway.
  process.exit(1);
}
