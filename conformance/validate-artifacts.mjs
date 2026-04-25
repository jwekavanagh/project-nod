#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { ARTIFACTS_DIR, ROOT, readJson } from "./lib.mjs";

const schema = readJson(path.join(ROOT, "schemas", "conformance-normalized-result.schema.json"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

for (const runtime of ["typescript", "python"]) {
  const file = path.join(ARTIFACTS_DIR, "conformance", runtime, "all.json");
  const payload = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(payload.results)) throw new Error(`${runtime}: missing results[]`);
  for (const result of payload.results) {
    if (!validate(result)) throw new Error(`${runtime}: invalid result for ${result.scenarioId}: ${ajv.errorsText(validate.errors)}`);
  }
}

console.log("conformance artifacts: schema valid");

