/** Ordered homepage section ids — validated in Vitest (conversion funnel order). */
export const HOME_SECTION_ORDER = [
  "hero",
  "coldProof",
  "scenario",
  "mechanism",
  "qualification",
  "guarantees",
  "example",
  "tryIt",
  "commercialSurface",
  "nextSteps",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_ORDER)[number];
