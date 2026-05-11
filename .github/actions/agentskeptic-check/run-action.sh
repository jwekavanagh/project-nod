#!/usr/bin/env bash
# Entry for composite action agentskeptic-check; env INPUT_* comes from action.yml mapping.
#
# Contract:
#   1. Run the published `agentskeptic` CLI via `npx`; capture stdout/stderr to files.
#   2. Parse the verdict line on stderr; decide the final exit code from CLI exit + INPUT_FAIL_ON.
#   3. Hand off to the certificate-derived presentation renderer
#      (.github/actions/agentskeptic-check/outcome-ci-surface.mjs) for $GITHUB_STEP_SUMMARY,
#      $GITHUB_OUTPUT, and the artifact source file. Renderer non-zero is non-fatal:
#      a ::warning:: is logged and a minimal fallback summary is written.
#   4. Exit with the previously decided code. Presentation never changes the exit code.
#
# Verdict wording: mirror README adoption-canonical verdict table (trusted / not_trusted / unknown).
set -euo pipefail

workflow_id="${INPUT_WORKFLOW_ID:?INPUT_WORKFLOW_ID is required}"
project="${INPUT_PROJECT:-}"
events="${INPUT_EVENTS:-}"
registry="${INPUT_REGISTRY:-}"

mode="${INPUT_MODE:-check}"
fail_on="${INPUT_FAIL_ON:-not_trusted_or_unknown}"
package="${INPUT_PACKAGE:-agentskeptic@latest}"
db="${INPUT_DB:-}"
share_origin="${INPUT_SHARE_REPORT_ORIGIN:-}"
extra_args="${INPUT_EXTRA_ARGS:-}"
enforce_coverage_budget="${INPUT_ENFORCE_COVERAGE_BUDGET:-false}"

fatal() {
  echo "::error::$*"
}

if [[ "$mode" != "check" && "$mode" != "enforce" ]]; then
  fatal "mode must be 'check' or 'enforce'; got '$mode'"
  exit 2
fi

case "$fail_on" in
not_trusted_or_unknown | not_trusted | never | critical_not_trusted_or_unknown) ;;
*)
  fatal "fail-on must be not_trusted_or_unknown, not_trusted, never, or critical_not_trusted_or_unknown; got '$fail_on'"
  exit 2
  ;;
esac

if [[ -n "$project" ]]; then
  if [[ -n "$events" || -n "$registry" ]]; then
    fatal "agentskeptic-check: set input project alone, or omit project and set both events and registry."
    exit 2
  fi
else
  if [[ -z "$events" || -z "$registry" ]]; then
    fatal "agentskeptic-check: when project is empty, both events and registry inputs are required."
    exit 2
  fi
fi

tmp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
mkdir -p "$tmp"
artifact_dir="$tmp/agentskeptic-ci"
mkdir -p "$artifact_dir"
stdout_path="$tmp/agentskeptic.stdout"
stderr_path="$tmp/agentskeptic.stderr"

# Build CLI argv (arrays avoid eval).
cmd=(npx --yes "$package" "$mode" --workflow-id "$workflow_id")
if [[ -n "$project" ]]; then
  cmd+=(--project "$project")
else
  cmd+=(--events "$events" --registry "$registry")
fi
if [[ -n "$db" ]]; then cmd+=(--db "$db"); fi
if [[ "$mode" == "check" && -n "$share_origin" ]]; then
  cmd+=(--share-report-origin "$share_origin")
fi
if [[ "$mode" == "check" && "$enforce_coverage_budget" == "true" ]]; then
  cmd+=(--enforce-coverage-budget)
fi
if [[ "$extra_args" =~ [^[:space:]] ]]; then
  read -r -a extras <<<"${extra_args}"
  ((${#extras[@]})) && cmd+=("${extras[@]}")
fi

set +e
"${cmd[@]}" >"$stdout_path" 2>"$stderr_path"
cli_exit=$?
set -e

# Parse truth_check_verdict from stderr (first matching line wins).
verdict=""
_line=""
if [[ -s "$stderr_path" ]]; then
  _line=$(grep -m1 -E '^truth_check_verdict:' "$stderr_path" 2>/dev/null || true)
  _line="${_line//$'\r'/}"
fi
if [[ "$_line" =~ ^truth_check_verdict:[[:space:]]*(trusted|not_trusted|unknown) ]]; then
  verdict="${BASH_REMATCH[1]}"
fi

# Parse release_critical_truth_check_verdict from stderr (first matching line wins).
crit=""
_line_crit=""
if [[ -s "$stderr_path" ]]; then
  _line_crit=$(grep -m1 -E '^release_critical_truth_check_verdict:' "$stderr_path" 2>/dev/null || true)
  _line_crit="${_line_crit//$'\r'/}"
fi
if [[ "$_line_crit" =~ ^release_critical_truth_check_verdict:[[:space:]]*(trusted|not_trusted|unknown) ]]; then
  crit="${BASH_REMATCH[1]}"
fi

# --- Decide the final exit code BEFORE invoking presentation renderer.
# Precedence: operational CLI failure always wins; then fail-on never; then global
# verdict thresholds; then release-critical-only threshold (stderr crit line).
final_exit=0
if (( cli_exit != 0 )); then
  final_exit="$cli_exit"
elif [[ "$fail_on" == "never" ]]; then
  final_exit=0
else
  case "$fail_on" in
  not_trusted_or_unknown)
    if [[ "$verdict" == "not_trusted" || "$verdict" == "unknown" ]]; then
      final_exit=1
    fi
    ;;
  not_trusted)
    if [[ "$verdict" == "not_trusted" ]]; then
      final_exit=1
    fi
    ;;
  critical_not_trusted_or_unknown)
    if [[ "$crit" != "trusted" && "$crit" != "not_trusted" && "$crit" != "unknown" ]]; then
      final_exit=1
    elif [[ "$crit" == "not_trusted" || "$crit" == "unknown" ]]; then
      final_exit=1
    fi
    ;;
  esac
fi

# --- Always emit baseline outputs (renderer also writes structured ones; these are safe defaults).
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "verdict=${verdict}"
    echo "stdout-path=${stdout_path}"
    echo "stderr-path=${stderr_path}"
    echo "exit-code=${cli_exit}"
  } >>"$GITHUB_OUTPUT"
fi

# --- Hand off to the certificate-derived presentation renderer.
# Renderer is the SSOT for summary markdown, structured outputs (state-relation,
# trust-decision, failing-tool-ids, primary-reason-codes, failing-witness-kinds,
# recommended-action, automation-safe, certificate-path), and the artifact file.
renderer="$GITHUB_ACTION_PATH/outcome-ci-surface.mjs"
renderer_node="${AGENTSKEPTIC_RENDERER_NODE:-node}"
renderer_rc=0
if [[ -f "$renderer" ]]; then
  set +e
  "$renderer_node" "$renderer" \
    --stdout-file "$stdout_path" \
    --stderr-file "$stderr_path" \
    --cli-exit "$cli_exit" \
    --mode "$mode" \
    --verdict "$verdict" \
    --artifact-dir "$artifact_dir"
  renderer_rc=$?
  set -e
else
  renderer_rc=127
fi

if (( renderer_rc != 0 )); then
  echo "::warning::agentskeptic-check: presentation renderer failed (rc=${renderer_rc}); see captured stderr/stdout paths" >&2
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    summary_verdict="$verdict"
    if [[ -z "$summary_verdict" ]]; then summary_verdict="unavailable"; fi
    {
      echo "## AgentSkeptic truth check (fallback)"
      echo ""
      echo "- mode: \`${mode}\`"
      echo "- verdict: \`${summary_verdict}\`"
      echo "- cli_exit: \`${cli_exit}\`"
      echo "- stdout: \`${stdout_path}\`"
      echo "- stderr: \`${stderr_path}\`"
      echo ""
      echo "_(certificate-derived summary unavailable: presentation renderer rc=${renderer_rc})_"
      echo ""
    } >>"$GITHUB_STEP_SUMMARY"
  fi
fi

cat "$stderr_path" >&2 || true
cat "$stdout_path" || true

exit "$final_exit"
