import { readFileSync } from "fs";
import type { ErrorObject } from "ajv";
import { CLI_OPERATIONAL_CODES, RETRY_OBSERVATIONS_DIVERGE_MESSAGE } from "./failureCatalog.js";
import { loadEventsForWorkflow } from "./loadEvents.js";
import { formatNoStepsForWorkflowMessage } from "./noStepsMessage.js";
import { planLogicalSteps } from "./planLogicalSteps.js";
import { buildRegistryMap, resolveVerificationRequest } from "./resolveExpectation.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { ToolRegistryEntry, ToolRegistryVerification } from "./types.js";
import { REGISTRY_READINESS_CODE, REGISTRY_VALIDATION_CODE } from "./wireReasonCodes.js";

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

export type RegistryReadinessIssueCode =
  (typeof REGISTRY_READINESS_CODE)[keyof typeof REGISTRY_READINESS_CODE];

export type RegistryReadinessIssueSeverity = "blocker" | "warning" | "unknown";

export type RegistryReadinessIssue = {
  code: RegistryReadinessIssueCode;
  severity: RegistryReadinessIssueSeverity;
  scope: "registry" | "witness";
  target: string;
  message: string;
  remediation: string;
};

export type RegistryWitnessReadiness = {
  witnessKind: "vector_document" | "object_storage_object" | "http_witness" | "mongo_document";
  target: string;
  status: "ready" | "blocked" | "unknown";
};

export type RegistryReadinessResult = {
  schemaVersion: 1;
  kind: "registry_readiness";
  overallStatus: "ready_to_attempt" | "blocked" | "unknown";
  summary: {
    blockers: number;
    warnings: number;
    unknowns: number;
  };
  structuralValidation: {
    valid: boolean;
    structuralIssueCount: number;
    resolutionIssueCount: number;
  };
  issues: RegistryReadinessIssue[];
  checkedWitnesses: RegistryWitnessReadiness[];
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
    const loadEv = loadEventsForWorkflow(evp, wfid);
    const { events, malformedEventLineCount, eventFileAggregateCounts } = loadEv;
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
            message: formatNoStepsForWorkflowMessage(wfid, eventFileAggregateCounts),
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

function readRegistryEntriesForReadiness(registryPath: string): ToolRegistryEntry[] {
  let raw: string;
  try {
    raw = readFileSync(registryPath, "utf8");
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
  if (!validateToolsRegistrySchema(parsed)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      "Registry is not schema-valid during readiness evaluation.",
    );
  }
  return parsed as ToolRegistryEntry[];
}

function isWitnessKind(
  kind: ToolRegistryVerification["kind"],
): kind is RegistryWitnessReadiness["witnessKind"] {
  return (
    kind === "vector_document" ||
    kind === "object_storage_object" ||
    kind === "http_witness" ||
    kind === "mongo_document"
  );
}

function verificationContainsPointer(v: ToolRegistryVerification): boolean {
  if (v.kind === "sql_effects") {
    return v.effects.some((e) => verificationContainsPointer({ kind: "sql_row", ...e }));
  }
  const visit = (x: unknown): boolean => {
    if (x === null || x === undefined) return false;
    if (Array.isArray(x)) return x.some((it) => visit(it));
    if (typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    if (typeof o.pointer === "string") return true;
    return Object.values(o).some((val) => visit(val));
  };
  return visit(v);
}

function pushIssue(
  issues: RegistryReadinessIssue[],
  seen: Set<string>,
  issue: RegistryReadinessIssue,
): void {
  const k = `${issue.code}\0${issue.target}\0${issue.message}`;
  if (seen.has(k)) return;
  seen.add(k);
  issues.push(issue);
}

export function formatRegistryReadinessHumanReport(result: RegistryReadinessResult): string {
  const lines = [`Registry readiness: ${result.overallStatus}`];
  for (const i of result.issues) {
    if (i.severity === "warning") continue;
    lines.push(`- ${i.code} (${i.target}): ${i.message} Next: ${i.remediation}`);
  }
  return lines.join("\n");
}

export function validateRegistryReadiness(input: {
  registryPath: string;
  eventsPath?: string;
  workflowId?: string;
  databaseMode: "sqlite" | "postgres";
  env?: NodeJS.ProcessEnv;
}): RegistryReadinessResult {
  const env = input.env ?? process.env;
  const validation = validateToolsRegistry({
    registryPath: input.registryPath,
    ...(input.eventsPath !== undefined ? { eventsPath: input.eventsPath } : {}),
    ...(input.workflowId !== undefined ? { workflowId: input.workflowId } : {}),
  });
  const issues: RegistryReadinessIssue[] = [];
  const checkedWitnesses: RegistryWitnessReadiness[] = [];
  const dedupe = new Set<string>();
  const structuralIssueCount = validation.structuralIssues.length;
  const resolutionIssueCount = validation.resolutionIssues.length;

  if (resolutionIssueCount > 0) {
    for (const r of validation.resolutionIssues) {
      pushIssue(issues, dedupe, {
        code: REGISTRY_READINESS_CODE.UNRESOLVED_REGISTRY_REFERENCE,
        severity: "blocker",
        scope: "registry",
        target: r.toolId ? `tool:${r.toolId}` : `workflow:${r.workflowId}`,
        message: `[${r.code}] ${r.message}`,
        remediation: "Fix registry pointers or event parameters so verification requests resolve.",
      });
    }
  }
  if (structuralIssueCount > 0) {
    for (const s of validation.structuralIssues) {
      pushIssue(issues, dedupe, {
        code: REGISTRY_READINESS_CODE.UNRESOLVED_REGISTRY_REFERENCE,
        severity: "blocker",
        scope: "registry",
        target: s.toolId ? `tool:${s.toolId}` : "registry",
        message: s.message,
        remediation: "Fix registry structure and schema issues before readiness checks.",
      });
    }
  }

  const entries = validation.valid ? readRegistryEntriesForReadiness(input.registryPath) : [];
  const hasEventContext = input.eventsPath !== undefined && input.workflowId !== undefined;

  for (const entry of entries) {
    const verification = entry.verification;
    if (!isWitnessKind(verification.kind)) continue;
    const target = `${entry.toolId}:${verification.kind}`;
    let status: RegistryWitnessReadiness["status"] = "ready";

    if (input.databaseMode === "sqlite") {
      status = "blocked";
      pushIssue(issues, dedupe, {
        code: REGISTRY_READINESS_CODE.UNSUPPORTED_WITNESS_DATABASE_MODE,
        severity: "blocker",
        scope: "witness",
        target,
        message: "Witness verification requires remote database mode, not SQLite file mode.",
        remediation: "Use --postgres-url for witness readiness and verification.",
      });
    }

    if (verification.kind === "vector_document") {
      const hostEnv =
        verification.provider === "pinecone"
          ? "PINECONE_INDEX_HOST"
          : verification.provider === "weaviate"
            ? "WEAVIATE_HOST"
            : "CHROMA_HOST";
      const keyEnv =
        verification.provider === "pinecone"
          ? "PINECONE_API_KEY"
          : verification.provider === "weaviate"
            ? "WEAVIATE_API_KEY"
            : "CHROMA_TENANT_AUTH_TOKEN|CHROMA_API_KEY";
      const hasHostConst = "const" in (verification.host ?? {});
      const hasHostEnv = Boolean((env[hostEnv] ?? "").trim());
      if (!hasHostConst && !hasHostEnv) {
        status = "blocked";
        pushIssue(issues, dedupe, {
          code: REGISTRY_READINESS_CODE.MISSING_WITNESS_CONFIGURATION,
          severity: "blocker",
          scope: "witness",
          target,
          message: `Missing ${verification.provider} host configuration (registry host or ${hostEnv}).`,
          remediation: `Set host in registry or provide ${hostEnv}.`,
        });
      }
      const hasApiKey =
        verification.provider === "chroma"
          ? Boolean((env.CHROMA_TENANT_AUTH_TOKEN ?? env.CHROMA_API_KEY ?? "").trim())
          : Boolean((env[verification.provider === "pinecone" ? "PINECONE_API_KEY" : "WEAVIATE_API_KEY"] ?? "").trim());
      if (!hasApiKey) {
        status = "blocked";
        pushIssue(issues, dedupe, {
          code: REGISTRY_READINESS_CODE.MISSING_ENV_VAR,
          severity: "blocker",
          scope: "witness",
          target,
          message: `Missing API credential env for ${verification.provider} (${keyEnv}).`,
          remediation: `Set ${keyEnv} before running verification.`,
        });
      }
    }

    if (verification.kind === "mongo_document") {
      const hasMongoUri = Boolean((env.AGENTSKEPTIC_MONGO_URL ?? env.MONGODB_URI ?? "").trim());
      if (!hasMongoUri) {
        status = "blocked";
        pushIssue(issues, dedupe, {
          code: REGISTRY_READINESS_CODE.MISSING_ENV_VAR,
          severity: "blocker",
          scope: "witness",
          target,
          message: "Missing MongoDB URI env (AGENTSKEPTIC_MONGO_URL or MONGODB_URI).",
          remediation: "Set AGENTSKEPTIC_MONGO_URL or MONGODB_URI before verification.",
        });
      }
    }

    if (!hasEventContext && verificationContainsPointer(verification) && status === "ready") {
      status = "unknown";
      pushIssue(issues, dedupe, {
        code: REGISTRY_READINESS_CODE.READINESS_UNKNOWN,
        severity: "unknown",
        scope: "witness",
        target,
        message: "Witness readiness depends on runtime pointer values not available without --events/--workflow-id.",
        remediation: "Provide --events and --workflow-id to resolve pointers for readiness.",
      });
    }

    checkedWitnesses.push({ witnessKind: verification.kind, target, status });
  }

  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const unknowns = issues.filter((i) => i.severity === "unknown").length;
  const overallStatus: RegistryReadinessResult["overallStatus"] =
    blockers > 0 ? "blocked" : unknowns > 0 ? "unknown" : "ready_to_attempt";

  return {
    schemaVersion: 1,
    kind: "registry_readiness",
    overallStatus,
    summary: { blockers, warnings, unknowns },
    structuralValidation: {
      valid: validation.valid,
      structuralIssueCount,
      resolutionIssueCount,
    },
    issues,
    checkedWitnesses,
  };
}
