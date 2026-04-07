import { readFileSync } from "fs";
import type { ErrorObject } from "ajv";
import {
  CLI_OPERATIONAL_CODES,
  RETRY_OBSERVATIONS_DIVERGE_MESSAGE,
  RUN_LEVEL_MESSAGES,
} from "./failureCatalog.js";
import { loadEventsForWorkflow } from "./loadEvents.js";
import { planLogicalSteps } from "./planLogicalSteps.js";
import { buildRegistryMap, resolveVerificationRequest } from "./resolveExpectation.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { ToolRegistryEntry } from "./types.js";
import { REGISTRY_VALIDATION_CODE } from "./wireReasonCodes.js";

const validateToolsRegistrySchema = loadSchemaValidator("tools-registry");

export type StructuralIssueKind =
  | "json_schema"
  | "duplicate_tool_id"
  | "sql_effects_duplicate_effect_id"
  | "sql_relational_duplicate_check_id";

export type StructuralIssue = {
  kind: StructuralIssueKind;
  message: string;
  instancePath?: string;
  keyword?: string;
  toolId?: string;
  effectId?: string;
  checkId?: string;
};

export type ResolutionIssue = {
  workflowId: string;
  code: string;
  message: string;
  seq: number | null;
  toolId: string | null;
};

export type ResolutionSkipped = {
  workflowId: string;
  seq: number;
  toolId: string;
  code: typeof REGISTRY_VALIDATION_CODE.RETRY_OBSERVATIONS_DIVERGE;
  message: string;
};

export type EventLoadSummary = {
  workflowId: string;
  malformedEventLineCount: number;
};

export type RegistryValidationResult = {
  schemaVersion: 1;
  valid: boolean;
  structuralIssues: StructuralIssue[];
  resolutionIssues: ResolutionIssue[];
  resolutionSkipped: ResolutionSkipped[];
  eventLoad?: EventLoadSummary;
};

function formatAjvMessage(err: ErrorObject): string {
  const base = err.message ?? "validation error";
  const params = err.params as Record<string, unknown>;
  if (params.allowedValues !== undefined) {
    return `${base} (allowed: ${JSON.stringify(params.allowedValues)})`;
  }
  return base;
}

export function structuralIssuesFromToolsRegistryAjv(errors: ErrorObject[] | null | undefined): StructuralIssue[] {
  if (!errors?.length) return [];
  const sorted = [...errors].sort((a, b) => {
    const pa = a.instancePath ?? "";
    const pb = b.instancePath ?? "";
    if (pa !== pb) return pa < pb ? -1 : 1;
    return (a.keyword ?? "").localeCompare(b.keyword ?? "");
  });
  return sorted.map((e) => ({
    kind: "json_schema" as const,
    instancePath: e.instancePath || "/",
    keyword: e.keyword,
    message: `${e.instancePath || "/"} (${e.keyword}) ${formatAjvMessage(e)}`,
  }));
}

function collectSqlEffectsDuplicateIssues(entries: ToolRegistryEntry[]): StructuralIssue[] {
  const out: StructuralIssue[] = [];
  for (const entry of entries) {
    const v = entry.verification;
    if (v.kind !== "sql_effects") continue;
    const seen = new Set<string>();
    for (const eff of v.effects) {
      if (seen.has(eff.id)) {
        out.push({
          kind: "sql_effects_duplicate_effect_id",
          toolId: entry.toolId,
          effectId: eff.id,
          message: `Duplicate effect id in registry for tool ${entry.toolId}: ${eff.id}`,
        });
        continue;
      }
      seen.add(eff.id);
    }
  }
  return out;
}

function collectSqlRelationalDuplicateCheckIssues(entries: ToolRegistryEntry[]): StructuralIssue[] {
  const out: StructuralIssue[] = [];
  for (const entry of entries) {
    const v = entry.verification;
    if (v.kind !== "sql_relational") continue;
    const seen = new Set<string>();
    for (const chk of v.checks) {
      if (seen.has(chk.id)) {
        out.push({
          kind: "sql_relational_duplicate_check_id",
          toolId: entry.toolId,
          checkId: chk.id,
          message: `Duplicate check id in registry for tool ${entry.toolId}: ${chk.id}`,
        });
        continue;
      }
      seen.add(chk.id);
    }
  }
  return out;
}

function resolutionSortKey(a: ResolutionIssue): [number, string] {
  const s = a.seq == null ? -1 : a.seq;
  const t = a.toolId ?? "";
  return [s, t];
}

export function sortedResolutionIssues(issues: ResolutionIssue[]): ResolutionIssue[] {
  return [...issues].sort((a, b) => {
    const [sa, ta] = resolutionSortKey(a);
    const [sb, tb] = resolutionSortKey(b);
    if (sa !== sb) return sa - sb;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

const HUMAN_HEADER = "Registry validation failed:";

/** Multi-line stderr for exit 1 (normative grammar: header + one line per issue). */
export function formatRegistryValidationHumanReport(result: RegistryValidationResult): string {
  if (result.valid) return "";
  const lines: string[] = [HUMAN_HEADER];
  for (const s of result.structuralIssues) {
    lines.push(`- structural (${s.kind}): ${s.message}`);
  }
  for (const r of sortedResolutionIssues(result.resolutionIssues)) {
    if (r.code === REGISTRY_VALIDATION_CODE.NO_STEPS_FOR_WORKFLOW) {
      lines.push(`- resolution (${r.code}): ${r.message}`);
    } else {
      lines.push(
        `- resolution (workflow ${r.workflowId} seq ${r.seq} tool ${r.toolId}): [${r.code}] ${r.message}`,
      );
    }
  }
  return lines.join("\n");
}

export function validateToolsRegistry(input: {
  registryPath: string;
  eventsPath?: string;
  workflowId?: string;
}): RegistryValidationResult {
  const evp = input.eventsPath;
  const wfid = input.workflowId;
  if ((evp !== undefined) !== (wfid !== undefined)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.VALIDATE_REGISTRY_USAGE,
      "Provide both --events and --workflow-id for event-backed resolution checks, or neither.",
    );
  }

  let raw: string;
  try {
    raw = readFileSync(input.registryPath, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.REGISTRY_READ_FAILED, msg, { cause: e });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.REGISTRY_JSON_SYNTAX, msg, { cause: e });
  }

  const structuralIssues: StructuralIssue[] = [];
  if (!validateToolsRegistrySchema(parsed)) {
    structuralIssues.push(...structuralIssuesFromToolsRegistryAjv(validateToolsRegistrySchema.errors ?? null));
    return {
      schemaVersion: 1,
      valid: false,
      structuralIssues,
      resolutionIssues: [],
      resolutionSkipped: [],
    };
  }

  const entries = parsed as ToolRegistryEntry[];
  structuralIssues.push(...collectSqlEffectsDuplicateIssues(entries));
  structuralIssues.push(...collectSqlRelationalDuplicateCheckIssues(entries));

  let registry: Map<string, ToolRegistryEntry>;
  try {
    registry = buildRegistryMap(entries);
  } catch (e) {
    if (e instanceof TruthLayerError && e.code === CLI_OPERATIONAL_CODES.REGISTRY_DUPLICATE_TOOL_ID) {
      structuralIssues.push({
        kind: "duplicate_tool_id",
        message: e.message,
      });
      return {
        schemaVersion: 1,
        valid: false,
        structuralIssues,
        resolutionIssues: [],
        resolutionSkipped: [],
      };
    }
    throw e;
  }

  if (structuralIssues.length > 0) {
    return {
      schemaVersion: 1,
      valid: false,
      structuralIssues,
      resolutionIssues: [],
      resolutionSkipped: [],
    };
  }

  if (evp !== undefined && wfid !== undefined) {
    const { events, malformedEventLineCount } = loadEventsForWorkflow(evp, wfid);
    const eventLoad: EventLoadSummary = { workflowId: wfid, malformedEventLineCount };

    if (events.length === 0) {
      return {
        schemaVersion: 1,
        valid: false,
        structuralIssues: [],
        resolutionIssues: [
          {
            workflowId: wfid,
            code: REGISTRY_VALIDATION_CODE.NO_STEPS_FOR_WORKFLOW,
            message: RUN_LEVEL_MESSAGES.NO_STEPS_FOR_WORKFLOW,
            seq: null,
            toolId: null,
          },
        ],
        resolutionSkipped: [],
        eventLoad,
      };
    }

    const resolutionIssues: ResolutionIssue[] = [];
    const resolutionSkipped: ResolutionSkipped[] = [];

    for (const plan of planLogicalSteps(events)) {
      const last = plan.last;
      if (plan.divergent) {
        resolutionSkipped.push({
          workflowId: wfid,
          seq: plan.seq,
          toolId: last.toolId,
          code: REGISTRY_VALIDATION_CODE.RETRY_OBSERVATIONS_DIVERGE,
          message: RETRY_OBSERVATIONS_DIVERGE_MESSAGE,
        });
        continue;
      }
      const entry = registry.get(last.toolId);
      if (!entry) {
        resolutionIssues.push({
          workflowId: wfid,
          code: REGISTRY_VALIDATION_CODE.UNKNOWN_TOOL,
          message: `Unknown toolId: ${last.toolId}`,
          seq: last.seq,
          toolId: last.toolId,
        });
        continue;
      }
      const resolved = resolveVerificationRequest(entry, last.params);
      if (!resolved.ok) {
        resolutionIssues.push({
          workflowId: wfid,
          code: resolved.code,
          message: resolved.message,
          seq: last.seq,
          toolId: last.toolId,
        });
      }
    }

    const valid = resolutionIssues.length === 0;
    return {
      schemaVersion: 1,
      valid,
      structuralIssues: [],
      resolutionIssues: sortedResolutionIssues(resolutionIssues),
      resolutionSkipped,
      eventLoad,
    };
  }

  return {
    schemaVersion: 1,
    valid: true,
    structuralIssues: [],
    resolutionIssues: [],
    resolutionSkipped: [],
  };
}
