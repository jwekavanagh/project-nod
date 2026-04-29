import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import ajvFormats from "ajv-formats";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const applyAjvFormats = ajvFormats as unknown as (ajv: InstanceType<typeof Ajv2020>) => InstanceType<typeof Ajv2020>;

const SCHEMA_SENTINEL = "workflow-result.schema.json";

function dirContainsSentinel(dir: string): boolean {
  try {
    return existsSync(path.join(dir, SCHEMA_SENTINEL));
  } catch {
    return false;
  }
}

/**
 * Directory holding `*.schema.json` files used by AJV.
 *
 * Default is the published package layout (`../schemas` next to `dist/`). Next.js / Vercel serverless
 * may place traced copies under `process.cwd()` instead, so we probe common locations. Override
 * with `AGENTSKEPTIC_SCHEMAS_DIR` when embedding outside the npm layout.
 */
let resolvedSchemasDir: string | null = null;

function resolveSchemasDir(): string {
  const env = process.env.AGENTSKEPTIC_SCHEMAS_DIR?.trim();
  if (env && dirContainsSentinel(env)) return env;

  const fromPackage = path.join(__dirname, "..", "schemas");
  if (dirContainsSentinel(fromPackage)) return fromPackage;

  const cwdSchemas = path.join(process.cwd(), "schemas");
  if (dirContainsSentinel(cwdSchemas)) return cwdSchemas;

  const parentSchemas = path.join(process.cwd(), "..", "schemas");
  if (dirContainsSentinel(parentSchemas)) return parentSchemas;

  return fromPackage;
}

export function schemasDir(): string {
  if (!resolvedSchemasDir) {
    resolvedSchemasDir = resolveSchemasDir();
  }
  return resolvedSchemasDir;
}

let ajvInstance: InstanceType<typeof Ajv2020> | null = null;

function getAjv(): InstanceType<typeof Ajv2020> {
  if (!ajvInstance) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    applyAjvFormats(ajv);
    ajvInstance = ajv;
  }
  return ajvInstance;
}

export type SchemaValidatorName =
  | "agent-run-record-v1"
  | "agent-run-record-v2"
  | "workflow-result-signature"
  | "event"
  | "execution-trace-view"
  | "tools-registry"
  | "workflow-engine-result"
  | "workflow-truth-report"
  | "workflow-result"
  | "workflow-result-v9"
  | "workflow-result-compare-input"
  | "run-comparison-report"
  | "registry-validation-result"
  | "cli-error-envelope"
  | "plan-validation-core"
  | "quick-verify-report"
  | "tools-registry-export"
  | "ci-lock-v1"
  | "assurance-manifest-v1"
  | "assurance-run-report-v1"
  | "assurance-output-v1"
  | "public-verification-report-v1"
  | "public-verification-report-v2"
  | "outcome-certificate-v1"
  | "compare-run-manifest-v1"
  | "regression-artifact-v1"
  | "bootstrap-pack-input-v1"
  | "openai-function-tool-call-item-v1"
  | "contract-manifest"
  | "local-run-history-index-v1"
  | "trust-decision-record-v1"
  | "trust-certificate-snapshot-v1";

const validatorCache: Partial<Record<SchemaValidatorName, ValidateFunction>> = {};

function compileSchemaFile(name: SchemaValidatorName, file: string): ValidateFunction {
  const cached = validatorCache[name];
  if (cached) return cached;

  const raw = readFileSync(path.join(schemasDir(), file), "utf8");
  const schema = JSON.parse(raw) as object & { $id?: string };
  const ajv = getAjv();
  try {
    const v = ajv.compile(schema);
    validatorCache[name] = v;
    return v;
  } catch (e) {
    const id = schema.$id;
    if (typeof id === "string" && ajv.getSchema(id) !== undefined) {
      ajv.removeSchema(id);
    }
    throw e;
  }
}

/** Ensures engine + truth schemas are registered before emitted `workflow-result` (cross-`$ref`). */
function ensureWorkflowEmittedDependencies(): void {
  compileSchemaFile("workflow-engine-result", "workflow-engine-result.schema.json");
  compileSchemaFile("workflow-truth-report", "workflow-truth-report.schema.json");
}

/** Ensures all branches of compare-input are registered before compiling compare-input. */
function ensureCompareInputDependencies(): void {
  ensureWorkflowEmittedDependencies();
  compileSchemaFile("workflow-result-v9", "workflow-result-v9.schema.json");
  compileSchemaFile("workflow-result", "workflow-result.schema.json");
}

function ensureWorkflowTruthForWireRefs(): void {
  compileSchemaFile("workflow-engine-result", "workflow-engine-result.schema.json");
  compileSchemaFile("workflow-truth-report", "workflow-truth-report.schema.json");
}

export function loadSchemaValidator(name: SchemaValidatorName): ValidateFunction {
  switch (name) {
    case "workflow-engine-result":
      return compileSchemaFile(name, "workflow-engine-result.schema.json");
    case "workflow-truth-report":
      compileSchemaFile("workflow-engine-result", "workflow-engine-result.schema.json");
      return compileSchemaFile(name, "workflow-truth-report.schema.json");
    case "workflow-result":
      ensureWorkflowEmittedDependencies();
      return compileSchemaFile(name, "workflow-result.schema.json");
    case "workflow-result-v9":
      ensureWorkflowEmittedDependencies();
      return compileSchemaFile(name, "workflow-result-v9.schema.json");
    case "workflow-result-compare-input":
      ensureCompareInputDependencies();
      return compileSchemaFile(name, "workflow-result-compare-input.schema.json");
    case "cli-error-envelope":
      ensureWorkflowTruthForWireRefs();
      return compileSchemaFile(name, "cli-error-envelope.schema.json");
    case "agent-run-record-v1":
      return compileSchemaFile(name, "agent-run-record-v1.schema.json");
    case "agent-run-record-v2":
      return compileSchemaFile(name, "agent-run-record-v2.schema.json");
    case "workflow-result-signature":
      return compileSchemaFile(name, "workflow-result-signature.schema.json");
    case "event":
      return compileSchemaFile(name, "event.schema.json");
    case "execution-trace-view":
      return compileSchemaFile(name, "execution-trace-view.schema.json");
    case "tools-registry":
      return compileSchemaFile(name, "tools-registry.schema.json");
    case "run-comparison-report":
      ensureWorkflowTruthForWireRefs();
      return compileSchemaFile(name, "run-comparison-report.schema.json");
    case "registry-validation-result":
      return compileSchemaFile(name, "registry-validation-result.schema.json");
    case "plan-validation-core":
      return compileSchemaFile(name, "plan-validation-core.schema.json");
    case "quick-verify-report":
      ensureWorkflowEmittedDependencies();
      return compileSchemaFile(name, "quick-verify-report.schema.json");
    case "tools-registry-export":
      compileSchemaFile("tools-registry", "tools-registry.schema.json");
      return compileSchemaFile(name, "tools-registry-export.schema.json");
    case "ci-lock-v1":
      return compileSchemaFile(name, "ci-lock-v1.schema.json");
    case "assurance-manifest-v1":
      return compileSchemaFile(name, "assurance-manifest-v1.schema.json");
    case "assurance-run-report-v1":
      return compileSchemaFile(name, "assurance-run-report-v1.schema.json");
    case "assurance-output-v1":
      return compileSchemaFile(name, "assurance-output-v1.schema.json");
    case "public-verification-report-v1":
      ensureWorkflowEmittedDependencies();
      compileSchemaFile("workflow-result", "workflow-result.schema.json");
      compileSchemaFile("quick-verify-report", "quick-verify-report.schema.json");
      return compileSchemaFile(name, "public-verification-report-v1.schema.json");
    case "outcome-certificate-v1":
      return compileSchemaFile(name, "outcome-certificate-v1.schema.json");
    case "compare-run-manifest-v1":
      return compileSchemaFile(name, "compare-run-manifest-v1.schema.json");
    case "regression-artifact-v1":
      compileSchemaFile("outcome-certificate-v1", "outcome-certificate-v1.schema.json");
      ensureWorkflowTruthForWireRefs();
      compileSchemaFile("run-comparison-report", "run-comparison-report.schema.json");
      compileSchemaFile("execution-trace-view", "execution-trace-view.schema.json");
      return compileSchemaFile(name, "regression-artifact-v1.schema.json");
    case "public-verification-report-v2":
      compileSchemaFile("outcome-certificate-v1", "outcome-certificate-v1.schema.json");
      return compileSchemaFile(name, "public-verification-report-v2.schema.json");
    case "openai-function-tool-call-item-v1":
      return compileSchemaFile(name, "openai-function-tool-call-item-v1.schema.json");
    case "bootstrap-pack-input-v1":
      compileSchemaFile("openai-function-tool-call-item-v1", "openai-function-tool-call-item-v1.schema.json");
      return compileSchemaFile(name, "bootstrap-pack-input-v1.schema.json");
    case "contract-manifest":
      return compileSchemaFile(name, "contract-manifest.schema.json");
    case "local-run-history-index-v1":
      return compileSchemaFile(name, "local-run-history-index-v1.schema.json");
    case "trust-certificate-snapshot-v1":
      return compileSchemaFile(name, "trust-certificate-snapshot-v1.schema.json");
    case "trust-decision-record-v1":
      compileSchemaFile("trust-certificate-snapshot-v1", "trust-certificate-snapshot-v1.schema.json");
      return compileSchemaFile(name, "trust-decision-record-v1.schema.json");
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}
