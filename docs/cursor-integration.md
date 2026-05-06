# Cursor integration: local truth check loop

This page is for teams using Cursor or agent-assisted coding in their own repositories.
It helps agents verify database or state outcomes before they claim a workflow change succeeded.

## 1) Copy the rule into your repo

Start from [`examples/cursor/agentskeptic-check.mdc`](../examples/cursor/agentskeptic-check.mdc) and copy it into your project's Cursor rules folder, typically:

`.cursor/rules/agentskeptic-check.mdc`

Cursor rule locations can vary by setup; if your workspace uses a different rule path, keep the same file content and contract.

## 2) Configure a project command

Add a script your agent can run consistently:

```json
{
  "scripts": {
    "agentskeptic:check": "agentskeptic check --workflow-id wf_complete --events examples/events.ndjson --registry examples/tools.json --db examples/demo.db"
  }
}
```

Replace `workflow-id`, events path, registry path, and database/state-store path with your own project values.

## 3) Expected result and claim policy

- stdout contains the Outcome Certificate.
- stderr begins with or includes `truth_check_verdict: trusted|not_trusted|unknown`.
- Agents should only claim the checked workflow is verified when verdict is `trusted`.
- If verdict is `not_trusted` or `unknown`, treat the workflow as not verified until the blocker is resolved.

## 4) Local Cursor loop vs CI

- Cursor rule: local/agent coding loop guidance.
- GitHub Action: CI enforcement of the same contract.
- Both paths use `agentskeptic check` and the same stdout/stderr semantics.

For CI wiring, see [`docs/ambient-ci-distribution.md`](ambient-ci-distribution.md).

## 5) Optional next step: enforce

`agentskeptic enforce` remains a later opt-in commercial/stateful step for baseline, drift, and acceptance workflows.
Keep local onboarding focused on `agentskeptic check` first.

## 6) Troubleshooting

- Missing events file: verify `--events` path and generated NDJSON location.
- Missing registry file: verify `--registry` path and tracked `tools.json`.
- DB path wrong/unavailable: verify `--db` (or equivalent state-store config) points to readable data.
- Verdict `unknown`: gather missing evidence or reduce the checked scope so trust can be determined.
- Verdict `not_trusted`: fix mismatched expected vs observed state before claiming success.

For full integration details and command reference, see [`docs/integrate.md`](integrate.md).
