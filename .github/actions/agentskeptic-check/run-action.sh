#!/usr/bin/env bash
# Entry for composite action agentskeptic-check; env INPUT_* comes from action.yml mapping.
# Verdict wording: mirror README adoption-canonical verdict table (trusted / not_trusted / unknown).
set -euo pipefail

MAX_SUMMARY_LINES="${MAX_SUMMARY_LINES:-200}"

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

fatal() {
  echo "::error::$*"
}

if [[ "$mode" != "check" && "$mode" != "enforce" ]]; then
  fatal "mode must be 'check' or 'enforce'; got '$mode'"
  exit 2
fi

case "$fail_on" in
not_trusted_or_unknown | not_trusted | never) ;;
*)
  fatal "fail-on must be not_trusted_or_unknown, not_trusted, or never; got '$fail_on'"
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
if [[ "$extra_args" =~ [^[:space:]] ]]; then
  read -r -a extras <<<"${extra_args}"
  ((${#extras[@]})) && cmd+=("${extras[@]}")
fi

set +e
"${cmd[@]}" >"$stdout_path" 2>"$stderr_path"
exit_code=$?
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

summary_verdict="$verdict"
if [[ -z "$summary_verdict" ]]; then summary_verdict="unavailable"; fi

# --- GitHub outputs
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "verdict=${verdict}"
    echo "stdout-path=${stdout_path}"
    echo "stderr-path=${stderr_path}"
    echo "exit-code=${exit_code}"
  } >>"$GITHUB_OUTPUT"
fi

line_count() {
  wc -l <"$1" | tr -d ' '
}

build_summary_section() {
  local file="$1"
  local kind="$2"
  local n="$MAX_SUMMARY_LINES"
  local total block note=""
  total=$(line_count "$file")
  # wc -l: empty file yields 0
  if ((total <= n)); then
    block=$(cat "$file")
  else
    if [[ "$kind" == "stderr" ]]; then
      block=$(tail -n "$n" "$file")
      note=$'\n\n_(stderr truncated to last '"${n}"' lines; file has '"${total}"' lines total)_'
    else
      block=$(head -n "$n" "$file")
      note=$'\n\n_(stdout truncated to first '"${n}"' lines; file has '"${total}"' lines total)_'
    fi
  fi
  printf '%s%s' "$block" "$note"
}

# --- Step summary
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  stderr_block=$(build_summary_section "$stderr_path" stderr)
  stdout_block=$(build_summary_section "$stdout_path" stdout)
  {
    echo "## AgentSkeptic truth check"
    echo ""
    echo "- Mode: \`$mode\`"
    echo "- Verdict: \`$summary_verdict\`"
    echo "- Exit code: \`$exit_code\`"
    echo "- Stdout: \`$stdout_path\`"
    echo "- Stderr: \`$stderr_path\`"
    echo ""
    echo "### Verdict meanings"
    echo ""
    echo "- **\`trusted\`** — Checked outcome matched expected downstream state — only this verdict means the workflow can be relied on."
    echo "- **\`not_trusted\`** — Determinate mismatch or required state missing. Do not claim verified; fix the mismatch."
    echo "- **\`unknown\`** — Evidence incomplete or not established. Do not claim verified; collect missing evidence or narrow checked scope."
    echo ""
    echo "Run-specific output: see **Human report / stderr** below (and Outcome Certificate in stdout)."
    echo ""
    echo "### Human report / stderr"
    echo ""
    echo '```text'
    printf '%s\n' "$stderr_block"
    echo '```'
    echo ""
    echo "### Outcome Certificate / stdout"
    echo ""
    echo '```text'
    printf '%s\n' "$stdout_block"
    echo '```'
    echo ""
  } >>"$GITHUB_STEP_SUMMARY"
fi

cat "$stderr_path" >&2 || true
cat "$stdout_path" || true

# --- Final exit policy
if [[ "$fail_on" == "never" ]]; then
  exit 0
fi

if ((exit_code != 0)); then
  exit "$exit_code"
fi

case "$fail_on" in
not_trusted_or_unknown)
  if [[ "$verdict" == "not_trusted" || "$verdict" == "unknown" ]]; then
    fatal "truth check failed: verdict is $verdict (fail-on: $fail_on)"
    exit 1
  fi
  ;;
not_trusted)
  if [[ "$verdict" == "not_trusted" ]]; then
    fatal "truth check failed: verdict is $verdict (fail-on: $fail_on)"
    exit 1
  fi
  ;;
esac

exit 0
