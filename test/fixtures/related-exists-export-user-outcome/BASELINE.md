# Baseline (before quick export bridge)

For the same `input.ndjson` + `schema.sql` snapshot, batch contract replay of the inferred **`related_exists`** obligation (`fk:qv_child.parent_id`) without using **`agentskeptic quick --export-registry`** required **hand-authored** registry + events:

```yaml
manual_registry_entries_required_for_same_contract_replay: 1
```

## Minimal hand-authored `tools.json` (one array element)

```json
[
  {
    "toolId": "baseline:rel",
    "effectDescriptionTemplate": "Baseline related_exists",
    "verification": {
      "kind": "sql_relational",
      "checks": [
        {
          "checkKind": "related_exists",
          "id": "fk:qv_child.parent_id",
          "childTable": { "const": "qv_child" },
          "matchEq": [{ "column": { "const": "parent_id" }, "value": { "const": "p1" } }]
        }
      ]
    }
  }
]
```

## Matching `tool_observed` NDJSON

```json
{"schemaVersion":1,"workflowId":"quick-verify","seq":0,"type":"tool_observed","toolId":"baseline:rel","params":{}}
```
