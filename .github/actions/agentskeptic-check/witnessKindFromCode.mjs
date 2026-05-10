// Failure-code-prefix → witness taxonomy (composite action standalone copy).
// Used only for structured output `failing-witness-kinds` (derived from spine / row codes).
// Modalities exercised on trusted runs live on `certificate.evidenceCompleteness.witnessCoverage`
// (see `src/witnessCoverageRollup.ts`; prefix mapping roots in src/wireReasonCodes.ts codes).

export const WITNESS_KIND_SQL = "sql";
export const WITNESS_KIND_HTTP = "http_witness";
export const WITNESS_KIND_OBJECT = "object_storage";
export const WITNESS_KIND_VECTOR = "vector_document";
export const WITNESS_KIND_MONGO = "mongo_document";
export const WITNESS_KIND_STATE = "state_witness";

const PREFIX_TABLE = [
  ["HTTP_WITNESS_", WITNESS_KIND_HTTP],
  ["OBJECT_", WITNESS_KIND_OBJECT],
  ["VECTOR_", WITNESS_KIND_VECTOR],
  ["MONGO_", WITNESS_KIND_MONGO],
  ["STATE_WITNESS_", WITNESS_KIND_STATE],
];

export function witnessKindFromCode(code) {
  if (typeof code !== "string" || code.length === 0) return WITNESS_KIND_SQL;
  for (const [prefix, kind] of PREFIX_TABLE) {
    if (code.startsWith(prefix)) return kind;
  }
  return WITNESS_KIND_SQL;
}

export function uniqueSortedWitnessKindsFromCodes(codes) {
  const set = new Set();
  for (const c of codes) set.add(witnessKindFromCode(c));
  return [...set].sort((a, b) => a.localeCompare(b));
}
