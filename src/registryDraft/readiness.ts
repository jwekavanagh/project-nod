import type { DraftProviderId } from "./parseAndNormalizeRegistryDraftRequest.js";
import {
  collectPointerStringsFromDraftTools,
  resolveJsonPointer,
} from "./jsonPointer.js";
import { mergeBootstrapToolArgumentsForPointers } from "./bootstrapArgsMerge.js";

export type ReadinessStatus = "ready" | "review" | "blocked";

const REASON_VALUES = [
  "REGISTRY_INVALID",
  "MERGE_FAILED",
  "MODEL_NON_JSON",
  "POINTERS_UNRESOLVED",
  "ASSUMPTIONS_PRESENT",
  "WARNINGS_PRESENT",
  "OK",
] as const;

export type ReadinessReasonCode = (typeof REASON_VALUES)[number];

export function scoreDraftReadiness(input: {
  assumptions: string[];
  warnings: string[];
  normalizedBootstrap: Record<string, unknown>;
  draftToolsUnknown: unknown;
}): {
  status: ReadinessStatus;
  reasons: ReadinessReasonCode[];
} {
  let pointerUnresolvedCount = 0;
  try {
    const doc = mergeBootstrapToolArgumentsForPointers(input.normalizedBootstrap);
    const ptrs = collectPointerStringsFromDraftTools(input.draftToolsUnknown);
    for (const p of ptrs) {
      const v = resolveJsonPointer(doc, p);
      if (v === undefined) pointerUnresolvedCount += 1;
    }
  } catch {
    pointerUnresolvedCount = 999;
  }

  const ass = input.assumptions.length > 0;
  const warn = input.warnings.length > 0;
  const ptr = pointerUnresolvedCount > 0;

  if (!ass && !warn && !ptr) {
    return { status: "ready", reasons: ["OK"] };
  }

  const reasons: ReadinessReasonCode[] = [];
  if (ass) reasons.push("ASSUMPTIONS_PRESENT");
  if (warn) reasons.push("WARNINGS_PRESENT");
  if (ptr) reasons.push("POINTERS_UNRESOLVED");

  return { status: "review", reasons };
}

export function modelLabelForGeneration(
  draftProvider: DraftProviderId,
  llmModelField: unknown,
  env: NodeJS.ProcessEnv,
): string {
  if (draftProvider === "local_ollama") {
    return (env["AGENTSKEPTIC_DRAFT_LOCAL_MODEL"] ?? "").trim() || fallbackModel(llmModelField);
  }
  return (env["REGISTRY_DRAFT_MODEL"] ?? "").trim() || fallbackModel(llmModelField) || "gpt-4o-mini";
}

function fallbackModel(llmModelField: unknown): string {
  if (
    llmModelField !== null &&
    typeof llmModelField === "object" &&
    "model" in (llmModelField as object) &&
    typeof (llmModelField as { model?: unknown }).model === "string"
  ) {
    const m = ((llmModelField as { model: string }).model ?? "").trim();
    if (m.length > 0) return m;
  }
  return "";
}
