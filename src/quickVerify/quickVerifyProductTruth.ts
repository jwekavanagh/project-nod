/**
 * First-class product truth on every QuickVerifyReport (stdout JSON).
 * Strings are duplicated in schemas/quick-verify-report.schema.json — keep in sync.
 */
export const DEFAULT_QUICK_VERIFY_PRODUCT_TRUTH = {
  doesNotProve: [
    "Does not prove the tool or action actually executed.",
    "Does not prove a write or other state change occurred.",
    "Only proves that current database state matches expectations derived from structured tool activity (quick: inferred expectations).",
  ],
  layers: {
    declared: "Declared: tool identity and parameters extracted from ingest (structured tool activity).",
    expected:
      "Expected: in quick mode, row and FK checks inferred from declared parameters (provisional, not a signed contract). In contract mode, registry-defined expectations from events.",
    observed: "Observed: read-only SQL results at verification time.",
  },
  quickVerifyProvisional: true as const,
  contractReplayPartialCoverage: true,
} as const;

/** Mutable copy for stdout JSON (`contractReplayPartialCoverage` is computed per run). */
export type QuickVerifyProductTruth = Omit<typeof DEFAULT_QUICK_VERIFY_PRODUCT_TRUTH, "contractReplayPartialCoverage"> & {
  contractReplayPartialCoverage: boolean;
};

export function buildQuickVerifyProductTruth(contractReplayPartialCoverage: boolean): QuickVerifyProductTruth {
  return {
    ...DEFAULT_QUICK_VERIFY_PRODUCT_TRUTH,
    contractReplayPartialCoverage,
  };
}
