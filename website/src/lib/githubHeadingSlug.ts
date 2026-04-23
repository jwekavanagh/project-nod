/**
 * GitHub-style markdown heading → URL fragment (see test/fixtures/github-heading-slug-vectors.json).
 */
export function githubHeadingSlug(headingPlainText: string): string {
  let s = headingPlainText.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
  s = s.replace(/[^a-z0-9]+/g, "-");
  s = s.replace(/^-+|-+$/g, "");
  while (s.includes("--")) {
    s = s.replace(/--+/g, "-");
  }
  return s;
}

export const DECISION_READY_PRODUCTION_COMPLETE_ADOPTION_BLOB_URL =
  "https://github.com/jwekavanagh/agentskeptic/blob/main/docs/adoption-epistemics.md#" +
  githubHeadingSlug("Decision-ready ProductionComplete (normative)");
