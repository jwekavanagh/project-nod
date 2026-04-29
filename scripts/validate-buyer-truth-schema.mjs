#!/usr/bin/env node
/**
 * Validates config/buyer-truth.v1.json against schemas/buyer-truth-v1.schema.json
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "config", "buyer-truth.v1.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(root, "schemas", "buyer-truth-v1.schema.json"), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(data)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
console.error("buyer-truth schema: ok");
