import type { ValidateFunction } from "ajv/dist/2020.js";
import { normalizeOpenAiToolCallsToBootstrapPackInput } from "./normalizeOpenAiToolCallsToBootstrapPackInput.js";

/** Explicit backend — default `hosted_openai`. No silent failover. */
export type DraftProviderId = "hosted_openai" | "local_ollama";

export type RegistryDraftParseResult =
  | {
      ok: true;
      normalizedBootstrapPackInput: Record<string, unknown>;
      ddlHint: string | undefined;
      draftProvider: DraftProviderId;
    }
  | { ok: false; errors: unknown };

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Validates envelope against registry-draft-request-v1, then returns normalized BootstrapPackInput + optional ddlHint.
 * Post-validates normalized object against bootstrap-pack-input-v1.
 */
export function parseAndNormalizeRegistryDraftRequest(
  envelope: unknown,
  validateRequest: ValidateFunction,
  validateBootstrap: ValidateFunction,
): RegistryDraftParseResult {
  if (!validateRequest(envelope)) {
    return { ok: false, errors: validateRequest.errors ?? [] };
  }

  const e = envelope as Record<string, unknown>;
  const ddlHintRaw = e.ddlHint;
  const ddlHint =
    typeof ddlHintRaw === "string" && ddlHintRaw.length > 0 ? ddlHintRaw : undefined;
  const draftProviderRaw = e["draftProvider"];
  const draftProvider: DraftProviderId =
    draftProviderRaw === "local_ollama" ? "local_ollama" : "hosted_openai";

  let normalized: Record<string, unknown>;
  if (e.inputKind === "bootstrap_pack_v1") {
    normalized = cloneJson(e.bootstrapPackInput as Record<string, unknown>);
  } else if (e.inputKind === "openai_tool_calls_v1") {
    normalized = normalizeOpenAiToolCallsToBootstrapPackInput({
      workflowId: e.workflowId as string,
      tool_calls: e.tool_calls as unknown[],
    });
  } else {
    return { ok: false, errors: [{ message: "unknown inputKind" }] };
  }

  if (!validateBootstrap(normalized)) {
    return { ok: false, errors: validateBootstrap.errors ?? [] };
  }

  return { ok: true, normalizedBootstrapPackInput: normalized, ddlHint, draftProvider };
}
