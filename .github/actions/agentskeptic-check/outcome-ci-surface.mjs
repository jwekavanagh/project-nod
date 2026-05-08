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

function fmtCoverageSnapshot(cert) {
  const ec = cert.evidenceCompleteness ?? {};
  const checked = Array.isArray(ec.verifiedClaims) ? ec.verifiedClaims.length : 0;
  const notChecked = Array.isArray(ec.unverifiedClaims) ? ec.unverifiedClaims.length : 0;
  const missing = Array.isArray(ec.missingInputs) ? ec.missingInputs.length : 0;
  return [
    "### Coverage snapshot",
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

// ---------- main ----------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.stdoutPath || !args.stderrPath) {
    console.error("outcome-ci-surface: --stdout-file and --stderr-file are required");
    process.exit(2);
  }

  const stdoutText = readFileSafe(args.stdoutPath, MAX_STDOUT_PARSE_BYTES);
  const stderrText = readFileSafe(args.stderrPath);

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
