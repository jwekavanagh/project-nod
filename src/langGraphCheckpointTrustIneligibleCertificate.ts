import { CLI_OPERATIONAL_CODES } from "./failureCatalog.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { Reason } from "./types.js";
import {
  buildIneligibleLangGraphCheckpointTrustCertificate,
  type OutcomeCertificateV1,
} from "./outcomeCertificate.js";

/**
 * Ineligible LangGraph checkpoint trust: Outcome Certificate only (no DB, no reconcile path).
 * Import surface is intentionally tiny; CI guards this file against forbidden imports.
 */
export function validatedLangGraphIneligibleCertificate(
  workflowId: string,
  reasons: Reason[],
): OutcomeCertificateV1 {
  const certificate = buildIneligibleLangGraphCheckpointTrustCertificate(workflowId, reasons);
  const validateCert = loadSchemaValidator("outcome-certificate-v1");
  if (!validateCert(certificate)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateCert.errors ?? []),
    );
  }
  return certificate;
}
