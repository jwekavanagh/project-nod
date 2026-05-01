import { readFileSync } from "node:fs";
import path from "node:path";
import { schemasDir } from "agentskeptic/schemaLoad";

/**
 * OpenAI `response_format.json_schema.schema` for the LLM-only registry draft shape.
 * Server merges with schemaVersion and quickIngestInput before full AJV.
 */
export function getOpenAiRegistryDraftLlmResponseJsonSchemaRoot(): Record<string, unknown> {
  const p = path.join(schemasDir(), "registry-draft-llm-partial-v1.schema.json");
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
}
