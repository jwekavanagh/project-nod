import { FIRST_FIVE_MINUTES_CHECKLIST } from "../firstFiveMinutesChecklist.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import type { AssuranceRunReportV1 } from "./runAssurance.js";

export type AssuranceOutputStaleV1 = {
  schemaVersion: 1;
  kind: "assurance_stale";
  firstFiveMinutesChecklist: string[];
  operatorLine: string;
  fresh: boolean;
  issuedAt: string;
  ageMs: number;
  maxAgeHours: number;
};

export type AssuranceOutputRunV1 = {
  schemaVersion: 1;
  kind: "assurance_run";
  firstFiveMinutesChecklist: string[];
  operatorLine: string;
  runReport: AssuranceRunReportV1;
};

export function formatRunOperatorLine(report: AssuranceRunReportV1): string {
  const bad = report.scenarios.filter((s) => s.exitCode !== 0);
  if (bad.length === 0) return "run: ok";
  return `run: ${bad.map((s) => `${s.id}=${s.exitCode}`).join(" ")}`;
}

export function formatStaleOperatorLine(
  fresh: boolean,
  issuedAt: string,
  ageMs: number,
  maxAgeHours: number,
): string {
  if (fresh) {
    return `stale: fresh ageMs=${ageMs} maxAgeHours=${maxAgeHours}`;
  }
  return `stale: exceeds_max_age issuedAt=${issuedAt} ageMs=${ageMs} maxAgeHours=${maxAgeHours}`;
}

function checklistCopy(): string[] {
  return [...FIRST_FIVE_MINUTES_CHECKLIST];
}

export function buildAssuranceStaleOutput(input: {
  fresh: boolean;
  issuedAt: string;
  ageMs: number;
  maxAgeHours: number;
}): AssuranceOutputStaleV1 {
  const operatorLine = formatStaleOperatorLine(
    input.fresh,
    input.issuedAt,
    input.ageMs,
    input.maxAgeHours,
  );
  return {
    schemaVersion: 1,
    kind: "assurance_stale",
    firstFiveMinutesChecklist: checklistCopy(),
    operatorLine,
    fresh: input.fresh,
    issuedAt: input.issuedAt,
    ageMs: input.ageMs,
    maxAgeHours: input.maxAgeHours,
  };
}

export function buildAssuranceRunOutput(report: AssuranceRunReportV1): AssuranceOutputRunV1 {
  return {
    schemaVersion: 1,
    kind: "assurance_run",
    firstFiveMinutesChecklist: checklistCopy(),
    operatorLine: formatRunOperatorLine(report),
    runReport: report,
  };
}

export function validateAndSerializeAssuranceOutput(
  obj: AssuranceOutputStaleV1 | AssuranceOutputRunV1,
): string {
  const v = loadSchemaValidator("assurance-output-v1");
  if (!v(obj)) {
    throw new Error(JSON.stringify(v.errors ?? []));
  }
  if (obj.kind === "assurance_run") {
    const vr = loadSchemaValidator("assurance-run-report-v1");
    if (!vr(obj.runReport)) {
      throw new Error(JSON.stringify(vr.errors ?? []));
    }
  }
  return `${JSON.stringify(obj)}\n`;
}
