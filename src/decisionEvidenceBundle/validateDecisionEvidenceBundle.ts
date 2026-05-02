import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { stringifyWithSortedKeys } from "../sortedJsonStringify.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import { DECISION_EVIDENCE_FILES } from "./constants.js";
import { computeCompletenessFromParts } from "./completeness.js";

export type DecisionBundleValidationLine = {
  schemaVersion: 1;
  kind: "decision_bundle_validation";
  status: "complete" | "partial" | "invalid";
  bundleDir: string;
  completeness: {
    status: "complete" | "partial" | "invalid";
    artifacts: {
      a4Present: boolean;
      a5Present: boolean;
      a5Required: boolean;
    };
  };
  errors: Array<{ code: string; message: string }>;
};

function parseJsonFile(abs: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    const raw = readFileSync(abs, "utf8").trim();
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

/**
 * Validates a directory produced by writeDecisionEvidenceBundle. Returns stdout payload object (serialize with {@link formatValidationStdout}).
 */
export function validateDecisionEvidenceBundle(bundleDir: string): DecisionBundleValidationLine {
  const resolved = path.resolve(bundleDir);
  const structuralErrors: Array<{ code: string; message: string }> = [];

  const ocPath = path.join(resolved, DECISION_EVIDENCE_FILES.outcomeCertificate);
  const exitPath = path.join(resolved, DECISION_EVIDENCE_FILES.exit);
  const hlPath = path.join(resolved, DECISION_EVIDENCE_FILES.humanLayer);
  const manifestPath = path.join(resolved, DECISION_EVIDENCE_FILES.manifest);
  const a4Path = path.join(resolved, DECISION_EVIDENCE_FILES.attestation);
  const a5Path = path.join(resolved, DECISION_EVIDENCE_FILES.nextAction);

  for (const [label, p] of [
    ["outcome-certificate.json", ocPath],
    ["exit.json", exitPath],
    ["human-layer.json", hlPath],
    ["manifest.json", manifestPath],
  ] as const) {
    if (!existsSync(p)) {
      structuralErrors.push({ code: "MISSING_FILE", message: `Missing ${label}.` });
    }
  }

  let certificate: OutcomeCertificateV1 | null = null;
  let certificateValid = false;

  if (existsSync(ocPath)) {
    const parsed = parseJsonFile(ocPath);
    if (!parsed.ok) {
      structuralErrors.push({ code: "CERTIFICATE_PARSE", message: parsed.message });
    } else {
      const v = loadSchemaValidator("outcome-certificate-v2");
      if (!v(parsed.value)) {
        structuralErrors.push({
          code: "CERTIFICATE_SCHEMA",
          message: JSON.stringify(v.errors ?? []),
        });
      } else {
        certificateValid = true;
        certificate = parsed.value as OutcomeCertificateV1;
      }
    }
  }

  if (existsSync(exitPath)) {
    const parsed = parseJsonFile(exitPath);
    if (!parsed.ok) {
      structuralErrors.push({ code: "EXIT_PARSE", message: parsed.message });
    } else {
      const v = loadSchemaValidator("decision-evidence-exit-v1");
      if (!v(parsed.value)) {
        structuralErrors.push({ code: "EXIT_SCHEMA", message: JSON.stringify(v.errors ?? []) });
      }
    }
  }

  if (existsSync(hlPath)) {
    const parsed = parseJsonFile(hlPath);
    if (!parsed.ok) {
      structuralErrors.push({ code: "HUMAN_LAYER_PARSE", message: parsed.message });
    } else {
      const v = loadSchemaValidator("decision-evidence-human-layer-v1");
      if (!v(parsed.value)) {
        structuralErrors.push({ code: "HUMAN_LAYER_SCHEMA", message: JSON.stringify(v.errors ?? []) });
      }
    }
  }

  const a4Present = existsSync(a4Path);
  const a5Present = existsSync(a5Path);

  if (a4Present) {
    const parsed = parseJsonFile(a4Path);
    if (!parsed.ok) {
      structuralErrors.push({ code: "ATTESTATION_PARSE", message: parsed.message });
    } else {
      const v = loadSchemaValidator("decision-evidence-attestation-v1");
      if (!v(parsed.value)) {
        structuralErrors.push({ code: "ATTESTATION_SCHEMA", message: JSON.stringify(v.errors ?? []) });
      }
    }
  }
  if (a5Present) {
    const parsed = parseJsonFile(a5Path);
    if (!parsed.ok) {
      structuralErrors.push({ code: "NEXT_ACTION_PARSE", message: parsed.message });
    } else {
      const v = loadSchemaValidator("decision-evidence-next-action-v1");
      if (!v(parsed.value)) {
        structuralErrors.push({ code: "NEXT_ACTION_SCHEMA", message: JSON.stringify(v.errors ?? []) });
      }
    }
  }

  if (existsSync(manifestPath)) {
    const parsed = parseJsonFile(manifestPath);
    if (!parsed.ok) {
      structuralErrors.push({ code: "MANIFEST_PARSE", message: parsed.message });
    } else {
      const v = loadSchemaValidator("decision-evidence-bundle-manifest-v1");
      if (!v(parsed.value)) {
        structuralErrors.push({ code: "MANIFEST_SCHEMA", message: JSON.stringify(v.errors ?? []) });
      }
    }
  }

  const coreFilesPresent =
    existsSync(ocPath) &&
    existsSync(exitPath) &&
    existsSync(hlPath) &&
    existsSync(manifestPath);

  const computed = computeCompletenessFromParts({
    certificateValid,
    coreFilesPresent,
    certificate,
    a4Present,
    a5Present,
  });

  if (structuralErrors.length > 0) {
    return {
      schemaVersion: 1,
      kind: "decision_bundle_validation",
      status: "invalid",
      bundleDir: resolved,
      completeness: {
        status: "invalid",
        artifacts: computed.artifacts,
      },
      errors: structuralErrors,
    };
  }

  const status = computed.status;
  return {
    schemaVersion: 1,
    kind: "decision_bundle_validation",
    status,
    bundleDir: resolved,
    completeness: {
      status,
      artifacts: computed.artifacts,
    },
    errors: computed.errors,
  };
}

export function formatValidationStdout(line: DecisionBundleValidationLine): string {
  return stringifyWithSortedKeys(line);
}
