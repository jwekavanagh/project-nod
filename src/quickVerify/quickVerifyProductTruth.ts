/**
 * First-class product truth on every QuickVerifyReport (stdout JSON).
 * Strings are duplicated in schemas/quick-verify-report.schema.json — keep in sync.
 */
export const DEFAULT_QUICK_VERIFY_PRODUCT_TRUTH = {
  doesNotProve: [
    "Does not prove the tool or action actually executed.",
    "Does not prove a write or other state change occurred.",
    "Quick-only: inferred SQL checks against read-only database reads—not the full contract surface (multi-store registry checks are contract verify).",
  ],
  layers: {
    declared: "Declared: tool identity and parameters extracted from ingest (structured tool activity).",
    expected:
      "Expected: quick mode uses provisional row/FK checks inferred from parameters. Contract verify uses registry-defined expectations (SQL plus HTTP witness, object storage, vector, Mongo where configured).",
    observed: "Observed: read-only SQL at verification time (quick mode).",
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
