import { publicProductAnchors } from "@/lib/publicProductAnchors";

const base = publicProductAnchors.gitRepositoryUrl.replace(/\/$/, "");

/** Canonical GitHub blob URL for the Python-first LangGraph verification README (integrator primacy). */
export const langgraphReferenceReadmeUrl = `${base}/blob/main/examples/python-verification/README.md`;
