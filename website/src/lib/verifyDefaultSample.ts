/** Deterministic default payload for `/verify` first run (ROW_ABSENT path). */
export const EXAMPLE_WF_MISSING_NDJSON =
  '{"schemaVersion":1,"workflowId":"wf_missing","seq":0,"type":"tool_observed","toolId":"crm.upsert_contact","params":{"recordId":"missing_id","fields":{"name":"X","status":"Y"}}}\n';
