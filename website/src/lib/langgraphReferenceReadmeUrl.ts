import { publicProductAnchors } from "@/lib/publicProductAnchors";

const base = publicProductAnchors.gitRepositoryUrl.replace(/\/$/, "");

/** Canonical GitHub blob URL for the LangGraph reference README (integrator primacy). */
export const langgraphReferenceReadmeUrl = `${base}/blob/main/examples/langgraph-reference/README.md`;
