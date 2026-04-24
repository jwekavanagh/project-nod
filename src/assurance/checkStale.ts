import { existsSync, readFileSync } from "node:fs";
import { loadSchemaValidator } from "../schemaLoad.js";

const FUTURE_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export type StaleCheckResult =
  | { kind: "fresh"; issuedAt: string; ageMs: number; maxAgeHours: number }
  | { kind: "stale"; issuedAt: string; ageMs: number; maxAgeHours: number }
  | { kind: "operational"; code: string; message: string };

/**
 * Exit semantics: fresh → caller exits 0; stale → 1; operational → 3 with envelope.
 * `issuedAt` more than ~5 minutes in the future is operational (clock skew / abuse), not "fresh".
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

  const now = Date.now();
  if (t > now + FUTURE_SKEW_TOLERANCE_MS) {
    return {
      kind: "operational",
      code: "ASSURANCE_REPORT_ISSUED_AT_FUTURE_SKEW",
      message: `issuedAt is more than ${FUTURE_SKEW_TOLERANCE_MS / 60000} minutes in the future vs server clock.`,
    };
  }

  const ageMs = now - t;
  const maxMs = maxAgeHours * 3600 * 1000;
  const meta = { issuedAt: rep.issuedAt, ageMs, maxAgeHours };
  if (ageMs > maxMs) return { kind: "stale", ...meta };
  return { kind: "fresh", ...meta };
}
