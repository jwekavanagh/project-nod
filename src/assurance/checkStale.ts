import { existsSync, readFileSync } from "node:fs";
import { loadSchemaValidator } from "../schemaLoad.js";

export type StaleCheckResult =
  | { kind: "fresh" }
  | { kind: "stale" }
  | { kind: "operational"; code: string; message: string };

/**
 * Exit semantics: fresh → caller exits 0; stale → 1; operational → 3 with envelope.
 */
export function checkAssuranceReportStale(
  reportPath: string,
  maxAgeHours: number,
): StaleCheckResult {
  if (!existsSync(reportPath)) {
    return {
      kind: "operational",
      code: "ASSURANCE_REPORT_READ_FAILED",
      message: `Report not found: ${reportPath}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
  } catch {
    return {
      kind: "operational",
      code: "ASSURANCE_REPORT_JSON_SYNTAX",
      message: "Report JSON parse failed.",
    };
  }

  const validate = loadSchemaValidator("assurance-run-report-v1");
  if (!validate(parsed)) {
    return {
      kind: "operational",
      code: "ASSURANCE_REPORT_SCHEMA_INVALID",
      message: JSON.stringify(validate.errors ?? []),
    };
  }

  const rep = parsed as { issuedAt: string };
  const t = Date.parse(rep.issuedAt);
  if (Number.isNaN(t)) {
    return {
      kind: "operational",
      code: "ASSURANCE_REPORT_SCHEMA_INVALID",
      message: "issuedAt is not a valid date.",
    };
  }

  const ageMs = Date.now() - t;
  const maxMs = maxAgeHours * 3600 * 1000;
  if (ageMs > maxMs) return { kind: "stale" };
  return { kind: "fresh" };
}
