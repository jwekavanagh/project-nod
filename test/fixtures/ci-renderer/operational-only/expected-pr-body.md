## AgentSkeptic — verification failed

Read-only checks at verify time—not color.

## Failure summary (agentskeptic)

- trust_decision: unknown
- summary: op sum
- actionable_failure: category=bad_input severity=low recommended_action=fix_cli_usage automation_safe=false
- primary_codes: _(operational)_
- rerun_guidance: cli msg
- source: operational
## CLI stderr (last 20 lines)

```text
{"schemaVersion":2,"kind":"execution_truth_layer_error","code":"CLI_USAGE","message":"cli msg","failureDiagnosis":{"summary":"op sum","primaryOrigin":"workflow_flow","confidence":"high","evidence":[{"referenceCode":"CLI_USAGE"}],"actionableFailure":{"category":"bad_input","severity":"low","recommendedAction":"fix_cli_usage","automationSafe":false}}}
```
---

- https://agentskeptic.com/
- https://agentskeptic.com/integrate
- https://agentskeptic.com/guides
- https://github.com/jwekavanagh/agentskeptic

<!-- agentskeptic-discovery:v1 -->
