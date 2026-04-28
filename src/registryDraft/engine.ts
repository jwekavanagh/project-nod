import { parseBootstrapPackInputJson, synthesizeQuickInputUtf8FromOpenAiV1 } from "../bootstrap/bootstrapPackSynthesis.js";
import type { ValidateFunction } from "ajv/dist/2020.js";
import { buildRegistryDraftPrompt } from "./buildRegistryDraftPrompt.js";
import type { DraftProviderId, RegistryDraftParseResult } from "./parseAndNormalizeRegistryDraftRequest.js";
import { scoreDraftReadiness, modelLabelForGeneration } from "./readiness.js";
import { callHostedOpenAiRegistryDraftJson } from "./providers/hosted_openai.js";
import { callLocalOllamaRegistryDraftJson } from "./providers/local_ollama.js";

export type DraftEngineSuccess = {
  ok: true;
  status: 200;
  body: Record<string, unknown>;
};

export type DraftEngineFailure = {
  ok: false;
  status: 400 | 500 | 502 | 503;
  body: Record<string, unknown>;
};

/**
 * Single orchestration pipeline: provider → merge → deterministic quick ingest → tools AJV → readiness → full AJV v3 envelope.
 */
export async function generateRegistryDraft(params: {
  parsed: Exclude<RegistryDraftParseResult, { ok: false }>;
  validateResponseEnvelope: ValidateFunction;
  validateToolsRegistryArray: ValidateFunction;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<DraftEngineSuccess | DraftEngineFailure> {
  const { normalizedBootstrapPackInput, ddlHint, draftProvider } = params.parsed;
  const prompt = buildRegistryDraftPrompt(normalizedBootstrapPackInput, ddlHint);
  const hostedModel = params.env["REGISTRY_DRAFT_MODEL"]?.trim() || "gpt-4o-mini";

  let llmPartialText: string | undefined;

  try {
    if (draftProvider === "hosted_openai") {
      const ai = await callHostedOpenAiRegistryDraftJson({
        prompt,
        model: hostedModel,
        env: params.env,
        fetchImpl: params.fetchImpl,
      });
      if (!ai.ok) {
        return {
          ok: false,
          status: ai.status as 503,
          body: { code: "OPENAI_ERROR", message: ai.message },
        };
      }
      llmPartialText = ai.contentText;
    } else {
      const o = await callLocalOllamaRegistryDraftJson({
        prompt,
        env: params.env,
        fetchImpl: params.fetchImpl,
      });
      if (!o.ok) {
        return {
          ok: false,
          status: o.status as 503,
          body: { code: "OLLAMA_ERROR", message: o.message },
        };
      }
      llmPartialText = o.contentText;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 503,
      body: { code: "PROVIDER_ERROR", message: msg.slice(0, 500) },
    };
  }

  let llmPartial: unknown;
  try {
    llmPartial = JSON.parse(llmPartialText!) as unknown;
  } catch {
    return {
      ok: false,
      status: 502,
      body: { code: "MODEL_OUTPUT_INVALID", message: "model returned non-JSON" },
    };
  }

  if (llmPartial === null || typeof llmPartial !== "object" || Array.isArray(llmPartial)) {
    return {
      ok: false,
      status: 502,
      body: { code: "MODEL_OUTPUT_INVALID", message: "model output must be a JSON object" },
    };
  }

  const lp = llmPartial as Record<string, unknown>;
  let bodyUtf8: string;
  try {
    const rawBootstrap = JSON.stringify(normalizedBootstrapPackInput);
    const pbi = parseBootstrapPackInputJson(rawBootstrap);
    bodyUtf8 = synthesizeQuickInputUtf8FromOpenAiV1(pbi);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 500, body: { code: "QUICK_INGEST_SYNTHESIS_FAILED", message: msg } };
  }

  const draftObj = lp["draft"];
  if (draftObj === null || typeof draftObj !== "object" || Array.isArray(draftObj)) {
    return {
      ok: false,
      status: 502,
      body: { code: "MODEL_OUTPUT_INVALID", message: "draft missing" },
    };
  }

  const toolsArr = (draftObj as Record<string, unknown>)["tools"];
  if (!params.validateToolsRegistryArray(toolsArr)) {
    const errs = params.validateToolsRegistryArray.errors ?? [];
    return {
      ok: false,
      status: 502,
      body: { code: "MODEL_OUTPUT_INVALID", errors: errs },
    };
  }

  const assumptionsRaw = lp["assumptions"];
  const warningsRaw = lp["warnings"];
  const assumptions = Array.isArray(assumptionsRaw) ? assumptionsRaw.filter((x) => typeof x === "string") : [];
  const warnings = Array.isArray(warningsRaw) ? warningsRaw.filter((x) => typeof x === "string") : [];

  const readiness = scoreDraftReadiness({
    assumptions,
    warnings,
    normalizedBootstrap: normalizedBootstrapPackInput,
    draftToolsUnknown: toolsArr,
  });

  const genModelLabel = modelLabelForGeneration(draftProvider, lp["model"], params.env);

  let disclaimerFinal = lp["disclaimer"];
  if (typeof disclaimerFinal !== "string" || disclaimerFinal.trim().length === 0) {
    disclaimerFinal = "Draft output requires human review before use.";
  }

  const merged = {
    schemaVersion: 3,
    draft: draftObj,
    assumptions,
    warnings,
    disclaimer: disclaimerFinal,
    generation: {
      backend: draftProvider,
      model: genModelLabel,
    },
    quickIngestInput: { encoding: "utf8" as const, body: bodyUtf8 },
    readiness,
    diagnostics: [] as Record<string, unknown>[],
  };

  const validateResponse = params.validateResponseEnvelope;
  if (!validateResponse(merged)) {
    return {
      ok: false,
      status: 502,
      body: { code: "MODEL_OUTPUT_INVALID", errors: validateResponse.errors ?? [] },
    };
  }

  return { ok: true, status: 200, body: merged };
}

export function credentialMissingForDraftProvider(
  draftProvider: DraftProviderId,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (draftProvider === "hosted_openai") {
    const k = env["OPENAI_API_KEY"];
    return k === undefined || k.trim().length === 0 ? "OPENAI_API_KEY required for hosted_openai draftProvider" : undefined;
  }
  const m = env["AGENTSKEPTIC_DRAFT_LOCAL_MODEL"];
  return m === undefined || m.trim().length === 0
    ? "AGENTSKEPTIC_DRAFT_LOCAL_MODEL required for local_ollama draftProvider"
    : undefined;
}
