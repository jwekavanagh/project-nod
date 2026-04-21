import { db } from "@/db/client";
import { sharedVerificationReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";

const MAX_BODY_BYTES = 393216;

const validateEnvelopeV2 = loadSchemaValidator("public-verification-report-v2");

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
    }
  | {
      schemaVersion: 2;
      certificate: Record<string, unknown>;
      cliVersion?: string;
      createdFrom?: string;
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
  if (!validateEnvelopeV2(raw)) {
    const err = new Error("ENVELOPE_INVALID");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  return raw as PublicReportEnvelope;
}

export function derivedFieldsFromEnvelope(env: PublicReportEnvelope): {
  kind: string;
  reportWorkflowId: string;
  reportStatusToken: string;
  humanText: string;
} {
  if (env.schemaVersion === 2) {
    const c = env.certificate as { workflowId: string; stateRelation: string; humanReport: string };
    return {
      kind: "outcome_certificate_v2",
      reportWorkflowId: c.workflowId,
      reportStatusToken: c.stateRelation,
      humanText: c.humanReport,
    };
  }
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
