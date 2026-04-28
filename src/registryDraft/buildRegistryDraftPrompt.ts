/**
 * Deterministic prompt text for registry-draft LLM (draft only; not verification).
 */
export function buildRegistryDraftPrompt(
  normalizedBootstrapPackInput: Record<string, unknown>,
  ddlHint: string | undefined,
): string {
  const payload = JSON.stringify(normalizedBootstrapPackInput);
  const hint = ddlHint?.trim()
    ? `\n\nOptional DDL / schema hint from operator (may be empty; do not treat as executable SQL):\n${ddlHint.trim()}`
    : "";
  return `You are drafting a tools.json registry for AgentSkeptic verification. Output is NOT executed on the server and is NOT truth.

Rules:
- Return ONLY JSON (no markdown fences, no prose). Top level: draft, assumptions, warnings, disclaimer, model. Do NOT include schemaVersion, quickIngestInput, or any other keys — the server adds those.
- draft.tools is a JSON array (min length 1). Each element MUST be an object with EXACTLY these three keys — no aliases, no extra keys:
  1) toolId (string, non-empty; use the function name from the bootstrap input, e.g. "crm.upsert_contact")
  2) effectDescriptionTemplate (string; describe the side effect; you may use JSON Pointer fragments like {/recordId} in the text)
  3) verification (object; choose one variant). Prefer sql_row when a single row should exist:
     { "kind": "sql_row", "table": { "const": "<table>" }, "identityEq": [ { "column": { "const": "<col>" }, "value": { "pointer": "<json-pointer>" } } ], "requiredFields": { "pointer": "<json-pointer>" } }
  The string "sql_row" belongs ONLY inside verification.kind — never use a sibling property named "sql_row", never rename verification to something else, and never put row-check fields at the top level of the tool object.
- Do NOT use "name" instead of toolId. Do NOT nest verification under informal keys.
- assumptions and warnings are string arrays (may be empty). disclaimer is a non-empty string (state human review required).
- model MUST be an object with EXACTLY one property: "model" — the model identifier string you are using (hosted or local). Do NOT include schemaVersion, quickIngestInput, generation, or provider fields.

Minimal structural example (placeholders — replace with values inferred from the bootstrap input):
{"draft":{"tools":[{"toolId":"namespace.tool_name","effectDescriptionTemplate":"Upsert row {/recordId} with fields {/fields}","verification":{"kind":"sql_row","table":{"const":"contacts"},"identityEq":[{"column":{"const":"id"},"value":{"pointer":"/recordId"}}],"requiredFields":{"pointer":"/fields"}}}]},"assumptions":[],"warnings":[],"disclaimer":"Draft only; review before use.","model":{"model":"gpt-4o-mini"}}

Do not claim execution correctness.

BootstrapPackInput (normalized) JSON:
${payload}${hint}`;
}
