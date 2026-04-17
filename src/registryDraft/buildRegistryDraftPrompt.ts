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
- Return ONLY JSON matching the response contract: schemaVersion 1, draft.tools as a non-empty tools registry array, assumptions (string array), warnings (string array), disclaimer (non-empty string stating the draft must be human-reviewed), model { provider: "openai", model: "<model id>" }.
- draft.tools must be valid AgentSkeptic tools registry entries mapping tool names from the bootstrap input to sql_row checks where possible.
- Do not claim execution correctness.

BootstrapPackInput (normalized) JSON:
${payload}${hint}`;
}
