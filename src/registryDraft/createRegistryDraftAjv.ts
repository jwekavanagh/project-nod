import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import ajvFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import path from "node:path";
import { schemasDir } from "../schemaLoad.js";

const applyAjvFormats = ajvFormats as unknown as (ajv: InstanceType<typeof Ajv2020>) => InstanceType<typeof Ajv2020>;

const SCHEMA_FILES_IN_ORDER = [
  "openai-function-tool-call-item-v1.schema.json",
  "bootstrap-pack-input-v1.schema.json",
  "registry-draft-request-v1.schema.json",
  "registry-draft-response.schema.json",
  "tools-registry.schema.json",
] as const;

const REGISTRY_DRAFT_REQUEST_ID = "https://agentskeptic.com/schemas/registry-draft-request-v1.schema.json";
const REGISTRY_DRAFT_RESPONSE_ID = "https://agentskeptic.com/schemas/registry-draft-response.schema.json";
const BOOTSTRAP_PACK_INPUT_ID = "https://agentskeptic.com/schemas/bootstrap-pack-input-v1.schema.json";
const TOOLS_REGISTRY_ID = "https://agentskeptic.com/schemas/tools-registry.schema.json";

/**
 * Isolated AJV for registry-draft HTTP + tests. Registration order is normative (see docs/registry-draft.md).
 */
export function createRegistryDraftAjv(): InstanceType<typeof Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  applyAjvFormats(ajv);
  const dir = schemasDir();
  for (const file of SCHEMA_FILES_IN_ORDER) {
    const raw = readFileSync(path.join(dir, file), "utf8");
    const schema = JSON.parse(raw) as object & { $id?: string };
    ajv.addSchema(schema);
  }
  return ajv;
}

let cachedAjv: InstanceType<typeof Ajv2020> | null = null;

function getSingletonAjv(): InstanceType<typeof Ajv2020> {
  if (!cachedAjv) {
    cachedAjv = createRegistryDraftAjv();
  }
  return cachedAjv;
}

export function getRegistryDraftRequestValidator(): ValidateFunction {
  const ajv = getSingletonAjv();
  const v = ajv.getSchema(REGISTRY_DRAFT_REQUEST_ID);
  if (!v) {
    throw new Error("registry-draft-request schema not registered");
  }
  return v;
}

export function getRegistryDraftResponseEnvelopeValidator(): ValidateFunction {
  const ajv = getSingletonAjv();
  const v = ajv.getSchema(REGISTRY_DRAFT_RESPONSE_ID);
  if (!v) {
    throw new Error("registry-draft-response schema not registered");
  }
  return v;
}

export function getBootstrapPackInputValidator(): ValidateFunction {
  const ajv = getSingletonAjv();
  const v = ajv.getSchema(BOOTSTRAP_PACK_INPUT_ID);
  if (!v) {
    throw new Error("bootstrap-pack-input schema not registered");
  }
  return v;
}

export function getToolsRegistryArrayValidator(): ValidateFunction {
  const ajv = getSingletonAjv();
  const v = ajv.getSchema(TOOLS_REGISTRY_ID);
  if (!v) {
    throw new Error("tools-registry schema not registered");
  }
  return v;
}
