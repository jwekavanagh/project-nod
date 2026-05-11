/**
 * Certificate-only Verification Diff kernel (Outcome Certificate v3).
 * CLASSIFICATION_RULES_SYNC: docs/agentskeptic.md#verification-diff-outcome-certificate-v3 (normative prose)
 *
 * Invariant: no workflow results, events, or traces — semantic posture projection only.
 */
import { certificateCanonicalDigestHex } from "./certificateDigest.js";
import type { OutcomeCertificateV3, OutcomeCertificateStateRelation } from "./outcomeCertificate.js";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { TruthLayerError } from "./truthLayerError.js";
import { stringifyWithSortedKeys } from "./sortedJsonStringify.js";

export const VERIFICATION_DIFF_SCHEMA_URL =
  "https://agentskeptic.com/schemas/verification-diff-certificate-v1.schema.json" as const;

export const VERIFICATION_DIFF_NEXT_STEP = {
  command: "agentskeptic compare --manifest <compare-run-manifest.json>",
  docAnchor: "docs/agentskeptic.md#cross-run-comparison-normative",
} as const;

export const VERIFICATION_DIFF_LIMITS = {
  certificateOnly: true,
  noEvents: true,
  noStepStructuralDiff: true,
} as const;

export type PostureMovement = "improved" | "weakened" | "unchanged" | "less_determinate" | "drifted";

export type DeterminacyClass = "established_positive" | "established_negative" | "not_established";

export type EvidenceProjection = {
  blockerCategory: string;
  supportLabel: string | null;
};

export type VerificationDiffCertificateV1 = {
  $schema: typeof VERIFICATION_DIFF_SCHEMA_URL;
  schemaVersion: 1;
  comparisonKind: "outcome_certificate_v3_semantic";
  workflowId: string;
  prior: {
    certificateSha256: string;
    runKind: OutcomeCertificateV3["runKind"];
    stateRelation: OutcomeCertificateStateRelation;
    releaseCriticalVerdict: OutcomeCertificateV3["releaseCriticalVerdict"];
    highStakesReliance: OutcomeCertificateV3["highStakesReliance"];
  };
  current: VerificationDiffCertificateV1["prior"];
  stateRelation: { prior: OutcomeCertificateStateRelation; current: OutcomeCertificateStateRelation; changed: boolean };
  releaseCriticalVerdict: {
    prior: OutcomeCertificateV3["releaseCriticalVerdict"];
    current: OutcomeCertificateV3["releaseCriticalVerdict"];
    changed: boolean;
  };
  highStakesReliance: {
    prior: OutcomeCertificateV3["highStakesReliance"];
    current: OutcomeCertificateV3["highStakesReliance"];
    changed: boolean;
  };
  runKind: { prior: OutcomeCertificateV3["runKind"]; current: OutcomeCertificateV3["runKind"]; changed: boolean };
  evidenceCompletenessProjection: { prior: EvidenceProjection; current: EvidenceProjection };
  completenessChanged: boolean;
  determinacy: {
    priorClass: DeterminacyClass;
    currentClass: DeterminacyClass;
    priorRank: 0 | 1 | 2;
    currentRank: 0 | 1 | 2;
  };
  lessDeterminate: boolean;
  postureMovement: PostureMovement;
  headline: string;
  recommendedNextAction: string;
  limits: typeof VERIFICATION_DIFF_LIMITS;
  nextStepHint: typeof VERIFICATION_DIFF_NEXT_STEP;
};

export function verificationDiffStderrFirstLine(): string {
  return "verification_diff_certificate: certificate-only semantic comparison (not structural run compare)";
}

export function evidenceProjection(c: OutcomeCertificateV3): EvidenceProjection {
  const ec = c.evidenceCompleteness as {
    blockerCategory: string;
    witnessCoverage?: { supportLabel?: string };
  };
  return {
    blockerCategory: ec.blockerCategory,
    supportLabel: ec.witnessCoverage?.supportLabel ?? null,
  };
}

export function canonicalEvidenceFingerprint(proj: EvidenceProjection): string {
  return stringifyWithSortedKeys({ blockerCategory: proj.blockerCategory, supportLabel: proj.supportLabel });
}

function determinacyClass(sr: OutcomeCertificateStateRelation): DeterminacyClass {
  if (sr === "matches_expectations") return "established_positive";
  if (sr === "does_not_match") return "established_negative";
  return "not_established";
}

function determinacyRank(c: DeterminacyClass): 0 | 1 | 2 {
  if (c === "established_positive") return 2;
  if (c === "established_negative") return 1;
  return 0;
}

function rcScore(rc: OutcomeCertificateV3["releaseCriticalVerdict"]): number {
  if (rc === "not_trusted") return 0;
  if (rc === "unknown") return 1;
  return 2;
}

function headlineFor(pm: PostureMovement): string {
  switch (pm) {
    case "unchanged":
      return "Verification posture unchanged between the two Outcome Certificates (projection-equal).";
    case "less_determinate":
      return "Verification became less determinate: trust dimensions lost a determinate established conclusion.";
    case "improved":
      return "Verification posture improved between prior and current Outcome Certificates.";
    case "weakened":
      return "Verification posture weakened between prior and current Outcome Certificates.";
    case "drifted":
      return "Verification posture drifted: material certificate fields changed without a single clear improved/weakened trust story.";
    default: {
      const _e: never = pm;
      return _e;
    }
  }
}

function recommendedNextActionFor(pm: PostureMovement): string {
  const boundary =
    "This conclusion is certificate-only semantic diff; it does not inspect events, traces, or step-level workflow structure.";
  const deeper = ` For structural compare use \`${VERIFICATION_DIFF_NEXT_STEP.command}\` (${VERIFICATION_DIFF_NEXT_STEP.docAnchor}).`;
  switch (pm) {
    case "unchanged":
      return `${boundary}${deeper}`;
    case "less_determinate":
      return `Treat the current artifact as withholding a determinate grounding that the prior certificate had; restore observability inputs or rerun verification.${deeper}`;
    case "improved":
      return `Promotion decision may proceed consistent with improved trust projections; archive both certificates.${deeper}`;
    case "weakened":
      return `Hold promotion or widen review: trust projections regressed versus the prior certificate; remediate downstream state / inputs before relying on current.${deeper}`;
    case "drifted":
      return `Reviewer should reconcile why evidence or run posture labels moved while primary trust projections stayed aligned; optionally rerun live verification.${deeper}`;
    default: {
      const _e: never = pm;
      return _e;
    }
  }
}

function certificatesSemanticallyEqualForDiff(
  before: OutcomeCertificateV3,
  after: OutcomeCertificateV3,
  fpBefore: string,
  fpAfter: string,
): boolean {
  return (
    before.workflowId === after.workflowId &&
    before.stateRelation === after.stateRelation &&
    before.releaseCriticalVerdict === after.releaseCriticalVerdict &&
    before.highStakesReliance === after.highStakesReliance &&
    before.runKind === after.runKind &&
    fpBefore === fpAfter
  );
}

function classifyPostureMovement(
  before: OutcomeCertificateV3,
  after: OutcomeCertificateV3,
  completenessChanged: boolean,
): PostureMovement {
  const SB = before.stateRelation;
  const SA = after.stateRelation;

  /** Steps 2–6 matched earlier (explicit for step 10 guard). */
  const steps2through6Matched =
    (SA === "not_established" && SB !== "not_established") ||
    (SB === "does_not_match" && SA === "matches_expectations") ||
    (SB === "matches_expectations" && SA === "does_not_match") ||
    (SB === "not_established" && SA === "matches_expectations") ||
    (SB === "not_established" && SA === "does_not_match");

  const fb = canonicalEvidenceFingerprint(evidenceProjection(before));
  const fa = canonicalEvidenceFingerprint(evidenceProjection(after));

  // Step 1
  if (certificatesSemanticallyEqualForDiff(before, after, fb, fa)) return "unchanged";

  // Step 2
  if (SA === "not_established" && SB !== "not_established") return "less_determinate";

  // Step 3
  if (SB === "does_not_match" && SA === "matches_expectations") return "improved";

  // Step 4
  if (SB === "matches_expectations" && SA === "does_not_match") return "weakened";

  // Step 5
  if (SB === "not_established" && SA === "matches_expectations") return "improved";

  // Step 6
  if (SB === "not_established" && SA === "does_not_match") return "weakened";

  // Step 7
  if (
    before.runKind !== after.runKind &&
    SB === SA &&
    before.releaseCriticalVerdict === after.releaseCriticalVerdict &&
    before.highStakesReliance === after.highStakesReliance &&
    !completenessChanged
  ) {
    return "drifted";
  }

  // Step 8: RC improved + SR not strictly worse (before=matches ∧ after≠matches would be strictly worse SR)
  if (
    rcScore(after.releaseCriticalVerdict) > rcScore(before.releaseCriticalVerdict) &&
    !(SB === "matches_expectations" && SA !== "matches_expectations")
  ) {
    return "improved";
  }

  // Step 9
  if (rcScore(after.releaseCriticalVerdict) < rcScore(before.releaseCriticalVerdict)) return "weakened";

  // Step 10
  if (before.highStakesReliance === "prohibited" && after.highStakesReliance === "permitted" && !steps2through6Matched) {
    return "improved";
  }

  // Step 11
  if (before.highStakesReliance === "permitted" && after.highStakesReliance === "prohibited") return "weakened";

  // Step 12
  if (
    completenessChanged &&
    SB === SA &&
    before.releaseCriticalVerdict === after.releaseCriticalVerdict &&
    before.highStakesReliance === after.highStakesReliance &&
    before.runKind === after.runKind
  ) {
    return "drifted";
  }

  return "unchanged";
}

/** Build Verification Diff from two validated Outcome Certificate v3 objects (before = prior artifact, after = current). */
export function buildVerificationDiffFromOutcomeCertificates(
  before: OutcomeCertificateV3,
  after: OutcomeCertificateV3,
): VerificationDiffCertificateV1 {
  if (before.workflowId !== after.workflowId) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.COMPARE_WORKFLOW_ID_MISMATCH,
      `Compare certificates: workflowId differs (before=${before.workflowId}, after=${after.workflowId}).`,
    );
  }

  const projBefore = evidenceProjection(before);
  const projAfter = evidenceProjection(after);
  const completenessChanged = canonicalEvidenceFingerprint(projBefore) !== canonicalEvidenceFingerprint(projAfter);

  const dcB = determinacyClass(before.stateRelation);
  const dcA = determinacyClass(after.stateRelation);
  const pr = determinacyRank(dcB);
  const cr = determinacyRank(dcA);
  const lessDeterminate = dcB !== "not_established" && dcA === "not_established";

  const postureMovement = classifyPostureMovement(before, after, completenessChanged);

  const priorFace = {
    certificateSha256: certificateCanonicalDigestHex(before),
    runKind: before.runKind,
    stateRelation: before.stateRelation,
    releaseCriticalVerdict: before.releaseCriticalVerdict,
    highStakesReliance: before.highStakesReliance,
  };
  const currentFace = {
    certificateSha256: certificateCanonicalDigestHex(after),
    runKind: after.runKind,
    stateRelation: after.stateRelation,
    releaseCriticalVerdict: after.releaseCriticalVerdict,
    highStakesReliance: after.highStakesReliance,
  };

  return {
    $schema: VERIFICATION_DIFF_SCHEMA_URL,
    schemaVersion: 1,
    comparisonKind: "outcome_certificate_v3_semantic",
    workflowId: before.workflowId,
    prior: priorFace,
    current: currentFace,
    stateRelation: {
      prior: before.stateRelation,
      current: after.stateRelation,
      changed: before.stateRelation !== after.stateRelation,
    },
    releaseCriticalVerdict: {
      prior: before.releaseCriticalVerdict,
      current: after.releaseCriticalVerdict,
      changed: before.releaseCriticalVerdict !== after.releaseCriticalVerdict,
    },
    highStakesReliance: {
      prior: before.highStakesReliance,
      current: after.highStakesReliance,
      changed: before.highStakesReliance !== after.highStakesReliance,
    },
    runKind: {
      prior: before.runKind,
      current: after.runKind,
      changed: before.runKind !== after.runKind,
    },
    evidenceCompletenessProjection: { prior: projBefore, current: projAfter },
    completenessChanged,
    determinacy: { priorClass: dcB, currentClass: dcA, priorRank: pr, currentRank: cr },
    lessDeterminate,
    postureMovement,
    headline: headlineFor(postureMovement),
    recommendedNextAction: recommendedNextActionFor(postureMovement),
    limits: { ...VERIFICATION_DIFF_LIMITS },
    nextStepHint: { ...VERIFICATION_DIFF_NEXT_STEP },
  };
}

/** Multi-line stderr block (no JSON) after deterministic first line. */
export function buildVerificationDiffHumanText(diff: VerificationDiffCertificateV1): string {
  const lines = [
    verificationDiffStderrFirstLine(),
    "",
    diff.headline,
    "",
    diff.recommendedNextAction,
    "",
    `Posture classification: ${diff.postureMovement}`,
    "",
    `State relation: prior=${diff.stateRelation.prior} current=${diff.stateRelation.current}`,
    "",
    `Limits: certificateOnly semantic diff (noEvents, noStepStructuralDiff).`,
  ];
  return lines.join("\n");
}

export function stringifyVerificationDiffCertificate(diff: VerificationDiffCertificateV1): string {
  return stringifyWithSortedKeys(diff);
}
