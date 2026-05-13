/**
 * Ordered paid-governance onboarding URLs shared by /integrate/guided, /account/governance empty state, and tests.
 */
export const GOVERNANCE_ONBOARDING_LINK_LABELS = [
  "Pricing — paid plan",
  "Account — API keys",
  "Buyer guide — stateful governance ladder",
  "CI enforcement reference (normative)",
  "Commercial GitHub Actions example",
  "Hosted governance export (doc)",
] as const;

export function governanceOnboardingHrefList(gitRepositoryUrl: string): readonly string[] {
  return [
    "/pricing",
    "/account",
    "/guides/buyer-ci-enforcement-metering",
    `${gitRepositoryUrl}/blob/main/docs/ci-enforcement.md#stateful-workflow`,
    `${gitRepositoryUrl}/blob/main/examples/github-actions/agentskeptic-commercial.yml`,
    `${gitRepositoryUrl}/blob/main/docs/decision-evidence-bundle.md`,
  ];
}
