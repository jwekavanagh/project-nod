// Witness kind taxonomy mirror.
// Source of truth for the prefix → witness mapping is src/wireReasonCodes.ts
// (HTTP_WITNESS_*, OBJECT_*, VECTOR_*, MONGO_*, STATE_WITNESS_*).
// This file is a tiny standalone copy so the composite action stays self-contained
// when consumed via `uses: OWNER/agentskeptic/.github/actions/agentskeptic-check@ref`.

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
