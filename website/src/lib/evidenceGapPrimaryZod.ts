import { z } from "zod";

/** Mirrors schemas/evidence-completeness-v1 `blockerCategory` (analytics + verify-outcome POST). */
export const evidenceGapPrimarySchema = z.enum([
  "none",
  "preview_lane",
  "ingest_empty",
  "ingest_unstructured",
  "registry_unknown_tool",
  "registry_resolution",
  "database_access",
  "timing_or_window",
  "witness_unavailable",
  "state_mismatch",
  "verification_incomplete",
  "event_sequence",
  "control_flow_context",
  "unclassified",
]);

export type EvidenceGapPrimaryWire = z.infer<typeof evidenceGapPrimarySchema>;
