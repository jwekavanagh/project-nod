import discoveryAcquisition from "./discoveryAcquisition";
import { publicProductAnchors } from "./publicProductAnchors";

export type IndexableGuide = (typeof discoveryAcquisition.indexableGuides)[number];

export function indexableGuideCanonical(path: string): string {
  const origin = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getIndexableGuide(path: string): IndexableGuide {
  const g = discoveryAcquisition.indexableGuides.find((x) => x.path === path);
  if (!g) {
    throw new Error(`indexableGuides: unknown path ${path}`);
  }
  return g;
}
