import { db } from "@/db/client";
import { sharedVerificationReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadSchemaValidator } from "agentskeptic";

const MAX_BODY_BYTES = 393216;

const validateEnvelope = loadSchemaValidator("public-verification-report-v1");
const validateWorkflowResult = loadSchemaValidator("workflow-result");
const validateQuickReport = loadSchemaValidator("quick-verify-report");

export type PublicReportEnvelope =
  | {
      schemaVersion: 1;
      kind: "workflow";
      workflowResult: unknown;
      truthReportText: string;
    }
  | {
      schemaVersion: 1;
      kind: "quick";
      workflowDisplayId: string;
      quickReport: unknown;
      humanReportText: string;
    };

export function assertBodySizeWithinLimit(rawUtf8: string): void {
  const bytes = Buffer.byteLength(rawUtf8, "utf8");
  if (bytes > MAX_BODY_BYTES) {
    const err = new Error("PAYLOAD_TOO_LARGE");
    (err as Error & { status: number }).status = 413;
    throw err;
  }
}

export function parseAndValidateEnvelope(raw: unknown): PublicReportEnvelope {
  if (!validateEnvelope(raw)) {
    const err = new Error("ENVELOPE_INVALID");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  const env = raw as PublicReportEnvelope;
  if (env.kind === "workflow") {
    if (!validateWorkflowResult(env.workflowResult)) {
      const err = new Error("WORKFLOW_RESULT_INVALID");
      (err as Error & { status: number }).status = 400;
      throw err;
    }
  } else {
    if (!validateQuickReport(env.quickReport)) {
      const err = new Error("QUICK_REPORT_INVALID");
      (err as Error & { status: number }).status = 400;
      throw err;
    }
  }
  return env;
}

export function derivedFieldsFromEnvelope(env: PublicReportEnvelope): {
  kind: "workflow" | "quick";
  reportWorkflowId: string;
  reportStatusToken: string;
  humanText: string;
} {
  if (env.kind === "workflow") {
    const wr = env.workflowResult as { workflowId: string; status: string };
    return {
      kind: "workflow",
      reportWorkflowId: wr.workflowId,
      reportStatusToken: wr.status,
      humanText: env.truthReportText,
    };
  }
  const qr = env.quickReport as { verdict: string };
  return {
    kind: "quick",
    reportWorkflowId: env.workflowDisplayId,
    reportStatusToken: qr.verdict,
    humanText: env.humanReportText,
  };
}

export async function insertPublicVerificationReport(
  envelope: PublicReportEnvelope,
): Promise<{ id: string }> {
  const derived = derivedFieldsFromEnvelope(envelope);
  const [row] = await db
    .insert(sharedVerificationReports)
    .values({
      kind: derived.kind,
      payload: envelope as object,
      reportWorkflowId: derived.reportWorkflowId,
      reportStatusToken: derived.reportStatusToken,
      humanText: derived.humanText,
    })
    .returning({ id: sharedVerificationReports.id });
  if (!row) {
    throw new Error("INSERT_FAILED");
  }
  return { id: row.id };
}

export async function selectPublicVerificationReportById(id: string) {
  const rows = await db
    .select()
    .from(sharedVerificationReports)
    .where(eq(sharedVerificationReports.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export { MAX_BODY_BYTES };
