/**
 * Canonical witness modality rollup for certificate evidence completeness.
 * Modality strings align with `.github/actions/agentskeptic-check/witnessKindFromCode.mjs` outputs.
 */

import type { StepOutcome, StepStatus, StepVerificationRequest } from "./types.js";

export const CANONICAL_WITNESS_KINDS = [
  "sql",
  "http_witness",
  "object_storage",
  "vector_document",
  "mongo_document",
  "state_witness",
] as const;

export type CanonicalWitnessRollupKind = (typeof CANONICAL_WITNESS_KINDS)[number];

export type WitnessCoverageSupportLabel =
  | "meaningful_multi_witness"
  | "sql_only_contract"
  | "single_non_sql_contract"
  | "thin_or_unknown"
  | "coverage_incomplete_or_failed";

export type WitnessCoverageRollupJson = {
  schemaVersion: 1;
  exercisedKinds: CanonicalWitnessRollupKind[];
  fullySatisfiedKinds: CanonicalWitnessRollupKind[];
  notFullySatisfiedKinds: CanonicalWitnessRollupKind[];
  supportLabel: WitnessCoverageSupportLabel;
  summaryLine?: string;
};

/** Rank per step touching a modality: higher = farther from verified. */
const STATUS_RANK: Record<StepStatus, number> = {
  verified: 0,
  uncertain: 1,
  incomplete_verification: 2,
  partially_verified: 3,
  missing: 4,
  inconsistent: 5,
};

const MAX_KINDS_DISPLAY = 24;

function sortedUniqueKinds(list: CanonicalWitnessRollupKind[]): CanonicalWitnessRollupKind[] {
  const set = new Set(list);
  return [...set].sort((a, b) => a.localeCompare(b)).slice(0, MAX_KINDS_DISPLAY);
}

/**
 * Maps a resolved verification request to canonical rollup modality buckets.
 * All SQL-shaped checks collapse to `sql`.
 */
export function witnessKindsFromVerificationRequest(req: StepVerificationRequest): CanonicalWitnessRollupKind[] {
  if (req === null) return [];
  switch (req.kind) {
    case "sql_row":
    case "sql_row_absent":
    case "sql_effects":
    case "sql_relational":
      return ["sql"];
    case "http_witness":
      return ["http_witness"];
    case "vector_document":
      return ["vector_document"];
    case "object_storage_object":
      return ["object_storage"];
    case "mongo_document":
      return ["mongo_document"];
  }
}

export function buildWitnessCoverageFromSteps(steps: StepOutcome[]): WitnessCoverageRollupJson {
  /** Worst status rank touching each modality across steps */
  const worstByKind = new Map<CanonicalWitnessRollupKind, number>();

  for (const step of steps) {
    const kinds = witnessKindsFromVerificationRequest(step.verificationRequest);
    if (kinds.length === 0) continue;
    const r = STATUS_RANK[step.status];
    for (const k of kinds) {
      const prev = worstByKind.get(k) ?? -1;
      worstByKind.set(k, Math.max(prev, r));
    }
  }

  const exercised = sortedUniqueKinds([...worstByKind.keys()]);
  const fullySatisfied: CanonicalWitnessRollupKind[] = [];
  const notFullySatisfied: CanonicalWitnessRollupKind[] = [];

  for (const k of exercised) {
    const w = worstByKind.get(k) ?? 5;
    if (w <= 0) fullySatisfied.push(k);
    else notFullySatisfied.push(k);
  }

  const supportLabel = deriveSupportLabel(exercised, fullySatisfied, notFullySatisfied, worstByKind);
  const summaryLine = formatSummaryLine(exercised, fullySatisfied, notFullySatisfied, supportLabel);

  return {
    schemaVersion: 1,
    exercisedKinds: exercised,
    fullySatisfiedKinds: sortedUniqueKinds(fullySatisfied),
    notFullySatisfiedKinds: sortedUniqueKinds(notFullySatisfied),
    supportLabel,
    ...(summaryLine.length > 0 ? { summaryLine } : {}),
  };
}

function deriveSupportLabel(
  exercisedKinds: CanonicalWitnessRollupKind[],
  fullySatisfiedKinds: CanonicalWitnessRollupKind[],
  notFullySatisfiedKinds: CanonicalWitnessRollupKind[],
  worstByKind: ReadonlyMap<CanonicalWitnessRollupKind, number>,
): WitnessCoverageSupportLabel {
  if (exercisedKinds.length === 0) return "thin_or_unknown";

  if (notFullySatisfiedKinds.length > 0) {
    void worstByKind;
    return "coverage_incomplete_or_failed";
  }

  if (fullySatisfiedKinds.length === exercisedKinds.length && exercisedKinds.length >= 2) {
    return "meaningful_multi_witness";
  }
  if (
    fullySatisfiedKinds.length === 1 &&
    fullySatisfiedKinds[0] === "sql" &&
    exercisedKinds.length === 1
  ) {
    return "sql_only_contract";
  }
  if (
    exercisedKinds.length === 1 &&
    fullySatisfiedKinds.length === 1 &&
    exercisedKinds[0] !== undefined &&
    exercisedKinds[0] !== "sql"
  ) {
    return "single_non_sql_contract";
  }
  return "coverage_incomplete_or_failed";
}

function formatSummaryLine(
  exercised: CanonicalWitnessRollupKind[],
  fullySatisfied: CanonicalWitnessRollupKind[],
  notFullySatisfied: CanonicalWitnessRollupKind[],
  label: WitnessCoverageSupportLabel,
): string {
  if (exercised.length === 0)
    return "No verification modalities exercised on captured steps with resolved verification targets.";
  const ex = exercised.join(",");
  const ok = fullySatisfied.join(",");
  const bad = notFullySatisfied.join(",") || "(none)";
  let body = "";
  switch (label) {
    case "meaningful_multi_witness":
      body = "Multiple modalities satisfied.";
      break;
    case "sql_only_contract":
      body = "SQL-only contract checks satisfied.";
      break;
    case "single_non_sql_contract":
      body = "Single non-SQL modality satisfied.";
      break;
    case "thin_or_unknown":
      body = "Thin or unknown witness footprint.";
      break;
    case "coverage_incomplete_or_failed":
      body = "One or more modalities incomplete, partial, mismatched, or failed.";
      break;
    default: {
      const _e: never = label;
      return _e;
    }
  }
  const raw = `[${body}] modalities_exercised=${ex} modalities_fully_satisfied=${ok} modalities_not_fully_satisfied=${bad}`;
  return raw.length <= 320 ? raw : `${raw.slice(0, 316)}…`;
}
