import { DatabaseSync } from "node:sqlite";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { buildQuickUnitCorrectnessDefinition } from "../correctnessDefinition.js";
import { TruthLayerError } from "../truthLayerError.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import type { CorrectnessDefinitionV1, ToolRegistryEntry, VerificationRequest, VerificationScalar } from "../types.js";
import { connectPostgresVerificationClient } from "../sqlReadBackend.js";
import { canonicalToolsArrayUtf8, stableStringify } from "./canonicalJson.js";
import { bucketsForAction } from "./decomposeUnits.js";
import { dedupeActions, ingestActivityUtf8, type FlatScalar } from "./ingest.js";
import { planRowUnit } from "./rowUnit.js";
import { planRelationalFromFlat } from "./relationalPlan.js";
import type { SchemaCatalog } from "./schemaCatalogTypes.js";
import { PostgresSchemaCatalog } from "./postgresCatalog.js";
import { SqliteSchemaCatalog } from "./sqliteCatalog.js";
import {
  exportSqlRelationalRelatedExistsTool,
  exportSqlRowParamPointerTool,
  exportSqlRowTool,
} from "./exportTool.js";
import { verifyRowPostgres, verifyRowSqlite, verifyRelatedExists } from "./verifyExecution.js";
import { T_COL, T_EXPORT, MAX_UNITS } from "./thresholds.js";
import { compareUtf16Id } from "../resolveExpectation.js";
import { MSG_NO_STRUCTURED_TOOL_ACTIVITY, MSG_NO_TOOL_CALLS } from "./quickVerifyHumanCopy.js";
import type { QuickContractExport } from "./buildQuickContractEventsNdjson.js";
import { DEFAULT_QUICK_VERIFY_SCOPE, type QuickVerifyScope } from "./quickVerifyScope.js";
import { buildQuickVerifyProductTruth, type QuickVerifyProductTruth } from "./quickVerifyProductTruth.js";
import { resolveVerificationRequest } from "../resolveExpectation.js";
import { buildQuickUnitReconciliation } from "../reconciliationPresentation.js";
import { buildSyntheticRowParams } from "./buildSyntheticRowParams.js";
import { flatKeyToJsonPointer } from "./flatKeyToJsonPointer.js";
import { normalizedSqlRowRequestFingerprint } from "./verificationRequestFingerprint.js";
import { deriveRemediationDecisionFromQuickReport } from "../actionableFailure.js";
import { buildEvidenceCompletenessFromQuickReport, type EvidenceCompletenessJson } from "../evidenceCompleteness.js";

export type QuickVerifyReport = {
  schemaVersion: 5;
  verdict: "pass" | "fail" | "uncertain";
  summary: string;
  verificationMode: "inferred";
  scope: QuickVerifyScope;
  productTruth: QuickVerifyProductTruth;
  ingest: { reasonCodes: string[]; malformedLineCount: number };
  ingestWarnings?: Array<{ code: string; actionKey?: string }>;
  runHeaderReasonCodes?: string[];
  evidenceCompleteness: EvidenceCompletenessJson;
  units: Array<{
    unitId: string;
    kind: "row" | "related_exists";
    verdict: "verified" | "fail" | "uncertain";
    confidence: number;
    reasonCodes: string[];
    sourceAction: { toolName: string; actionIndex: number };
    contractEligible: boolean;
    inference: { table: string; rationale: string[]; alternates?: unknown[] };
    verification: Record<string, unknown>;
    explanation: string;
    reconciliation: {
      declared: string;
      expected: string;
      observed_database: string;
      verification_verdict: string;
    };
    correctnessDefinition?: CorrectnessDefinitionV1;
  }>;
  exportableRegistry: { tools: ToolRegistryEntry[] };
};

export type RunQuickVerifyOptions = {
  inputUtf8: string;
  postgresUrl?: string;
  sqlitePath?: string;
};

export type RunQuickVerifyResult = {
  report: QuickVerifyReport;
  registryUtf8: string;
  contractExports: QuickContractExport[];
};

function rollupVerdict(
  units: QuickVerifyReport["units"],
  ingestCodes: string[],
  hadActions: boolean,
): "pass" | "fail" | "uncertain" {
  if (
    !hadActions &&
    (ingestCodes.includes("INGEST_NO_ACTIONS") || ingestCodes.includes("INGEST_NO_STRUCTURED_TOOL_ACTIVITY"))
  ) {
    return "uncertain";
  }
  if (units.length === 0) return "uncertain";
  if (units.some((u) => u.verdict === "fail")) return "fail";
  if (units.every((u) => u.verdict === "verified")) return "pass";
  return "uncertain";
}

/**
 * Provisional quick verify may intentionally use an under-specified row request (identity only). Contract replay
 * must still carry non-PK field expectations when `fields.*` flat keys are present so full verify can surface
 * VALUE_MISMATCH (bootstrap pack / activation).
 */
function augmentExportVerificationRequest(
  provisional: VerificationRequest,
  flat: Record<string, FlatScalar>,
  tableColumnNames: string[],
  pkColumns: string[],
): VerificationRequest {
  if (Object.keys(provisional.requiredFields).length > 0) return provisional;
  const pkSet = new Set(pkColumns);
  const rf: Record<string, VerificationScalar> = {};
  const flatPaths = [...Object.keys(flat)].sort(compareUtf16Id);
  for (const fk of flatPaths) {
    if (!fk.startsWith("fields.") || fk.indexOf(".", "fields.".length) !== -1) continue;
    const colName = fk.slice("fields.".length);
    if (pkSet.has(colName) || !tableColumnNames.includes(colName)) continue;
    const raw = flat[fk] ?? null;
    let vs: VerificationScalar | undefined;
    if (raw === null) vs = null;
    else if (typeof raw === "boolean") vs = raw;
    else if (typeof raw === "number") vs = Number.isFinite(raw) ? raw : undefined;
    else if (typeof raw === "string") vs = raw;
    if (vs !== undefined) rf[colName] = vs;
  }
  if (Object.keys(rf).length === 0) return provisional;
  return { ...provisional, requiredFields: rf };
}

/** Placeholder evidence so `deriveRemediationDecisionFromQuickReport` can run before real completeness is built. */
function stubEvidenceCompletenessForQuickDecision(): EvidenceCompletenessJson {
  return {
    schemaVersion: 1,
    blockerCategory: "preview_lane",
    quickSignal: "sql_ran_uncertain",
    verifiedClaims: [],
    unverifiedClaims: [],
    missingInputs: [{ code: "_pending", hint: "_" }],
    nextActions: [{ id: "_pending", text: "_" }],
  };
}

/** Synthetic full report for remediation derivation only (`evidenceCompleteness` is discarded afterward). */
function quickReportShapeForDecision(
  partial: Pick<
    QuickVerifyReport,
    | "verdict"
    | "summary"
    | "ingest"
    | "units"
    | "productTruth"
    | "scope"
    | "ingestWarnings"
    | "runHeaderReasonCodes"
  >,
): QuickVerifyReport {
  return {
    schemaVersion: 5,
    verificationMode: "inferred",
    exportableRegistry: { tools: [] },
    ...partial,
    evidenceCompleteness: stubEvidenceCompletenessForQuickDecision(),
  };
}

const QUICK_VERIFY_DECISION_WORKFLOW_ID = "quick_verify";

function buildSummary(verdict: string, units: QuickVerifyReport["units"], ingest: QuickVerifyReport["ingest"]): string {
  const parts = [
    `Inferred provisional check — rollup ${verdict} is not a production-safety or audit-final verdict`,
    `${units.length} unit(s)`,
  ];
  if (ingest.reasonCodes.includes("INGEST_NO_ACTIONS")) {
    parts.push(MSG_NO_TOOL_CALLS);
  } else if (ingest.reasonCodes.includes("INGEST_NO_STRUCTURED_TOOL_ACTIVITY")) {
    parts.push(MSG_NO_STRUCTURED_TOOL_ACTIVITY);
  } else if (ingest.reasonCodes.length) {
    parts.push(`ingest: ${ingest.reasonCodes.join(",")}`);
  }
  return parts.join(". ") + ".";
}

export async function runQuickVerify(opts: RunQuickVerifyOptions): Promise<RunQuickVerifyResult> {
  const ingest = ingestActivityUtf8(opts.inputUtf8);
  const ingestBlock = {
    reasonCodes: ingest.reasonCodes,
    malformedLineCount: ingest.malformedLineCount,
  };

  if (ingest.inputTooLarge) {
    const units: QuickVerifyReport["units"] = [];
    const verdict = "uncertain" as const;
    const summary = buildSummary("uncertain", units, ingestBlock);
    const decision = deriveRemediationDecisionFromQuickReport(
      quickReportShapeForDecision({
        verdict,
        summary,
        ingest: ingestBlock,
        units,
        productTruth: buildQuickVerifyProductTruth(false),
        scope: { ...DEFAULT_QUICK_VERIFY_SCOPE },
      }),
      QUICK_VERIFY_DECISION_WORKFLOW_ID,
    );
    const evidenceCompleteness = buildEvidenceCompletenessFromQuickReport(
      {
        verdict,
        ingest: ingestBlock,
        units: [],
      },
      decision,
    );
    const report: QuickVerifyReport = {
      schemaVersion: 5,
      verdict,
      summary,
      verificationMode: "inferred",
      scope: { ...DEFAULT_QUICK_VERIFY_SCOPE },
      productTruth: buildQuickVerifyProductTruth(false),
      ingest: ingestBlock,
      evidenceCompleteness,
      units,
      exportableRegistry: { tools: [] },
    };
    return { report, registryUtf8: canonicalToolsArrayUtf8([]), contractExports: [] };
  }

  const { unique, droppedWarnings } = dedupeActions(ingest.actions);
  const ingestWarnings = droppedWarnings.length
    ? droppedWarnings.map((code) => ({ code }))
    : undefined;

  let catalog: SchemaCatalog;
  let dialect: "postgres" | "sqlite";
  let pgClient: Awaited<ReturnType<typeof connectPostgresVerificationClient>> | undefined;
  let sqliteDb: DatabaseSync | undefined;

  if (opts.postgresUrl) {
    pgClient = await connectPostgresVerificationClient(opts.postgresUrl);
    catalog = new PostgresSchemaCatalog(pgClient);
    dialect = "postgres";
  } else if (opts.sqlitePath) {
    sqliteDb = new DatabaseSync(opts.sqlitePath, { readOnly: true });
    catalog = new SqliteSchemaCatalog(sqliteDb);
    dialect = "sqlite";
  } else {
    throw new Error("runQuickVerify: postgresUrl or sqlitePath required");
  }

  try {
    const tables = await catalog.listTables();
    const fkEdges = await catalog.listFkEdges();
    const units: QuickVerifyReport["units"] = [];
    const exportTools: ToolRegistryEntry[] = [];
    const contractExports: QuickContractExport[] = [];
    const runHeaderReasonCodes: string[] = [];
    const relationalSeen = new Set<string>();

    const pushUnit = (u: QuickVerifyReport["units"][0]) => {
      if (units.length >= MAX_UNITS) {
        if (!runHeaderReasonCodes.includes("UNIT_CAP_EXCEEDED")) runHeaderReasonCodes.push("UNIT_CAP_EXCEEDED");
        return;
      }
      units.push(u);
    };

    for (let actionIndex = 0; actionIndex < unique.length; actionIndex++) {
      const action = unique[actionIndex]!;
      const sourceAction = { toolName: action.toolName, actionIndex };
      const bs = bucketsForAction(action.toolName, action.flat, tables);
      for (const b of bs) {
        if (units.length >= MAX_UNITS) break;
        const plan = await planRowUnit(catalog, b, tables);
        const uid = `u${units.length}`;
        if (!plan.request) {
          const rc = plan.reasonCodes.length ? plan.reasonCodes : ["MAPPING_FAILED"];
          pushUnit({
            unitId: uid,
            kind: "row",
            verdict: "uncertain",
            confidence: plan.confidence,
            reasonCodes: rc,
            sourceAction,
            contractEligible: false,
            inference: {
              table: b.tableName,
              rationale: plan.rationale,
              alternates: plan.alternates,
            },
            verification: {},
            reconciliation: buildQuickUnitReconciliation({
              kind: "row_mapping_failed",
              toolName: sourceAction.toolName,
              actionIndex,
              flat: action.flat,
              confidence: plan.confidence,
            }),
            explanation: plan.rationale.join(" ") || "Could not map row unit.",
            correctnessDefinition: buildQuickUnitCorrectnessDefinition({
              unitId: uid,
              kind: "row",
              toolName: sourceAction.toolName,
              actionIndex: sourceAction.actionIndex,
              table: b.tableName,
              reasonCodes: rc,
            }),
          });
          continue;
        }
        const rowOut =
          dialect === "postgres"
            ? await verifyRowPostgres(pgClient!, plan.request)
            : verifyRowSqlite(sqliteDb!, plan.request);
        const exportedLegacy = plan.confidence >= T_EXPORT;
        let exportedPointer = false;
        let pointerSynthetic: Record<string, unknown> | undefined;
        let pointerSpecs: Array<{ column: string; valuePointer: string }> | undefined;
        if (
          rowOut.verdict === "verified" &&
          plan.pointerComplete &&
          plan.pkFlatBindings &&
          plan.confidence >= T_COL &&
          plan.confidence < T_EXPORT
        ) {
          const qvFieldsSorted: Record<string, VerificationScalar> = {};
          for (const k of Object.keys(plan.request.requiredFields).sort(compareUtf16Id)) {
            qvFieldsSorted[k] = plan.request.requiredFields[k]!;
          }
          try {
            pointerSynthetic = buildSyntheticRowParams(action.params, qvFieldsSorted);
          } catch {
            pointerSynthetic = undefined;
          }
          if (pointerSynthetic) {
            const sortedBindings = [...plan.pkFlatBindings].sort((a, b) =>
              compareUtf16Id(a.column, b.column),
            );
            const specs: Array<{ column: string; valuePointer: string }> = [];
            let ptrOk = true;
            for (const b of sortedBindings) {
              const fp = flatKeyToJsonPointer(b.flatKey);
              if (!fp.ok) {
                ptrOk = false;
                break;
              }
              specs.push({ column: b.column, valuePointer: fp.pointer });
            }
            if (ptrOk && specs.length > 0) {
              let tidProbe = `quick:${uid}`;
              const usedProbe = new Set(exportTools.map((t) => t.toolId));
              let nProbe = 1;
              while (usedProbe.has(tidProbe)) {
                tidProbe = `quick:${uid}:${nProbe++}`;
              }
              const regProbe = exportSqlRowParamPointerTool(tidProbe, plan.request.table, specs);
              const resolved = resolveVerificationRequest(regProbe, pointerSynthetic);
              if (
                resolved.ok &&
                resolved.verificationKind === "sql_row" &&
                normalizedSqlRowRequestFingerprint(resolved.request) ===
                  normalizedSqlRowRequestFingerprint(plan.request)
              ) {
                exportedPointer = true;
                pointerSpecs = specs;
              }
            }
          }
        }
        const exported = exportedLegacy || exportedPointer;
        let tid = `quick:${uid}`;
        if (exported) {
          const used = new Set(exportTools.map((t) => t.toolId));
          let n = 1;
          while (used.has(tid)) {
            tid = `quick:${uid}:${n++}`;
          }
          if (exportedLegacy) {
            const colsForExport = await catalog.listColumns(b.tableName);
            const colNamesForExport = colsForExport.map((c) => c.name).sort(compareUtf16Id);
            const pkSetForExport = new Set(plan.request.identityEq.map((e) => e.column));
            const exportRowRequest = augmentExportVerificationRequest(
              plan.request,
              b.flat,
              colNamesForExport,
              [...pkSetForExport],
            );
            exportTools.push(exportSqlRowTool(tid, exportRowRequest));
            const qvFieldsSortedLegacy: Record<string, VerificationScalar> = {};
            for (const k of Object.keys(exportRowRequest.requiredFields).sort(compareUtf16Id)) {
              qvFieldsSortedLegacy[k] = exportRowRequest.requiredFields[k]!;
            }
            contractExports.push({
              toolId: tid,
              kind: "sql_row",
              request: exportRowRequest,
              syntheticParams: buildSyntheticRowParams(action.params, qvFieldsSortedLegacy),
            });
          } else if (exportedPointer && pointerSynthetic && pointerSpecs) {
            exportTools.push(exportSqlRowParamPointerTool(tid, plan.request.table, pointerSpecs));
            contractExports.push({
              toolId: tid,
              kind: "sql_row",
              request: plan.request,
              syntheticParams: pointerSynthetic,
            });
          }
        }
        const rowReconciliation =
          rowOut.verdict === "verified"
            ? buildQuickUnitReconciliation({
                kind: "row_verified",
                toolName: sourceAction.toolName,
                actionIndex,
                flat: action.flat,
                table: plan.request.table,
                request: plan.request,
                verification: rowOut.verification,
                verdict: "verified",
                confidence: plan.confidence,
              })
            : buildQuickUnitReconciliation({
                kind: "row_fail_or_uncertain",
                toolName: sourceAction.toolName,
                actionIndex,
                flat: action.flat,
                table: plan.request.table,
                request: plan.request,
                verification: rowOut.verification,
                verdict: rowOut.verdict,
                reasonCodes: rowOut.reasonCodes,
                confidence: plan.confidence,
              });
        const rowBase = {
          unitId: uid,
          kind: "row" as const,
          verdict: rowOut.verdict,
          confidence: plan.confidence,
          reasonCodes: rowOut.reasonCodes,
          sourceAction,
          contractEligible: exported,
          inference: { table: plan.request.table, rationale: plan.rationale },
          verification: rowOut.verification,
          explanation: rowOut.explanation,
          reconciliation: rowReconciliation,
        };
        pushUnit(
          rowOut.verdict === "verified"
            ? rowBase
            : {
                ...rowBase,
                correctnessDefinition: buildQuickUnitCorrectnessDefinition({
                  unitId: uid,
                  kind: "row",
                  toolName: sourceAction.toolName,
                  actionIndex: sourceAction.actionIndex,
                  table: plan.request.table,
                  reasonCodes: rowOut.reasonCodes,
                  sqlRowRequest: plan.request,
                }),
              },
        );
      }

      const rels = planRelationalFromFlat(action.flat, fkEdges);
      for (const rel of rels) {
        if (units.length >= MAX_UNITS) break;
        const rk = `${rel.childTable}\0${rel.matchEq.map((m) => m.column).join(",")}`;
        if (relationalSeen.has(rk)) continue;
        relationalSeen.add(rk);
        const uid = `u${units.length}`;
        const rout =
          dialect === "postgres"
            ? await verifyRelatedExists("postgresql", pgClient!, rel)
            : await verifyRelatedExists("sqlite", sqliteDb!, rel);
        const relConfidence = 0.8;
        let relContractEligible = false;
        if (rout.verdict === "verified" && relConfidence >= T_EXPORT) {
          const rtid0 = `quick:rel:${rel.id}`;
          let rtid = rtid0;
          let entry = exportSqlRelationalRelatedExistsTool(rtid, rel);
          let res = resolveVerificationRequest(entry, {});
          if (res.ok) {
            const used = new Set(exportTools.map((t) => t.toolId));
            let n = 1;
            while (used.has(rtid)) {
              rtid = `${rtid0}:${n++}`;
              entry = exportSqlRelationalRelatedExistsTool(rtid, rel);
              res = resolveVerificationRequest(entry, {});
              if (!res.ok) break;
            }
            if (res.ok) {
              exportTools.push(entry);
              contractExports.push({ toolId: rtid, kind: "related_exists_export" });
              relContractEligible = true;
            }
          }
        }
        const relBase = {
          unitId: uid,
          kind: "related_exists" as const,
          verdict: rout.verdict,
          confidence: relConfidence,
          reasonCodes: rout.reasonCodes,
          sourceAction,
          contractEligible: relContractEligible,
          inference: { table: rel.childTable, rationale: [`FK ${rel.id}`] },
          verification: rout.verification,
          explanation: rout.explanation,
          reconciliation: buildQuickUnitReconciliation({
            kind: "related_exists",
            toolName: sourceAction.toolName,
            actionIndex,
            flat: action.flat,
            check: rel,
            verdict: rout.verdict,
            reasonCodes: rout.reasonCodes,
            confidence: relConfidence,
          }),
        };
        pushUnit(
          rout.verdict === "verified"
            ? relBase
            : {
                ...relBase,
                correctnessDefinition: buildQuickUnitCorrectnessDefinition({
                  unitId: uid,
                  kind: "related_exists",
                  toolName: sourceAction.toolName,
                  actionIndex: sourceAction.actionIndex,
                  table: rel.childTable,
                  reasonCodes: rout.reasonCodes,
                  relationalCheck: rel,
                }),
              },
        );
      }
    }

    const hadActions = ingest.actions.length > 0;
    const verdict = rollupVerdict(units, ingest.reasonCodes, hadActions);
    exportTools.sort((a, b) => compareUtf16Id(a.toolId, b.toolId));
    contractExports.sort((a, b) => compareUtf16Id(a.toolId, b.toolId));

    const anyNotContractEligible = units.some((u) => !u.contractEligible);
    const contractReplayPartialCoverage = exportTools.length > 0 && anyNotContractEligible;

    const summary = buildSummary(verdict, units, ingestBlock);
    const decision = deriveRemediationDecisionFromQuickReport(
      quickReportShapeForDecision({
        verdict,
        summary,
        ingest: ingestBlock,
        units,
        productTruth: buildQuickVerifyProductTruth(contractReplayPartialCoverage),
        scope: { ...DEFAULT_QUICK_VERIFY_SCOPE },
        ...(ingestWarnings ? { ingestWarnings } : {}),
        ...(runHeaderReasonCodes.length ? { runHeaderReasonCodes } : {}),
      }),
      QUICK_VERIFY_DECISION_WORKFLOW_ID,
    );
    const evidenceCompleteness = buildEvidenceCompletenessFromQuickReport(
      {
        verdict,
        ingest: ingestBlock,
        units: units.map((u) => ({
          unitId: u.unitId,
          verdict: u.verdict,
          reasonCodes: u.reasonCodes,
          sourceAction: u.sourceAction,
          reconciliation: u.reconciliation,
          verification: u.verification,
        })),
      },
      decision,
    );
    const report: QuickVerifyReport = {
      schemaVersion: 5,
      verdict,
      summary,
      verificationMode: "inferred",
      scope: { ...DEFAULT_QUICK_VERIFY_SCOPE },
      productTruth: buildQuickVerifyProductTruth(contractReplayPartialCoverage),
      ingest: ingestBlock,
      ...(ingestWarnings ? { ingestWarnings } : {}),
      ...(runHeaderReasonCodes.length ? { runHeaderReasonCodes } : {}),
      evidenceCompleteness,
      units,
      exportableRegistry: { tools: exportTools },
    };

    const registryUtf8 = canonicalToolsArrayUtf8(report.exportableRegistry.tools);
    return { report, registryUtf8, contractExports };
  } finally {
    if (pgClient) {
      try {
        await pgClient.end();
      } catch {
        /* */
      }
    }
    if (sqliteDb) {
      try {
        sqliteDb.close();
      } catch {
        /* */
      }
    }
  }
}

/** For tests: stable single-line report JSON */
export function quickReportToStdoutLine(report: QuickVerifyReport): string {
  return stableStringify(report) + "\n";
}

export async function runQuickVerifyToValidatedReport(opts: RunQuickVerifyOptions): Promise<RunQuickVerifyResult> {
  const out = await runQuickVerify(opts);
  const validateQuickReport = loadSchemaValidator("quick-verify-report");
  if (!validateQuickReport(out.report)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateQuickReport.errors ?? []),
    );
  }
  return out;
}
