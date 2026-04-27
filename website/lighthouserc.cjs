/**
 * LHCI `assertMatrix` only (cannot mix with top-level `assertions` — see @lhci/utils).
 * Home is heavier than /pricing and /security; performance scores are noisy in CI runners.
 */
const categoryAssertions = {
  "categories:accessibility": ["error", { minScore: 0.96 }],
  "categories:best-practices": ["error", { minScore: 0.96 }],
  "categories:seo": ["error", { minScore: 0.96 }],
};

module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:3040/",
        "http://127.0.0.1:3040/pricing",
        "http://127.0.0.1:3040/security",
      ],
      numberOfRuns: 1,
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: "^http://127\\.0\\.0\\.1:3040/$",
          assertions: {
            ...categoryAssertions,
            // Tighter floor on inner pages; home still guards large regressions.
            "categories:performance": ["error", { minScore: 0.55 }],
          },
        },
        {
          matchingUrlPattern: "^http://127\\.0\\.0\\.1:3040/pricing$",
          assertions: {
            ...categoryAssertions,
            "categories:performance": ["error", { minScore: 0.68 }],
          },
        },
        {
          matchingUrlPattern: "^http://127\\.0\\.0\\.1:3040/security$",
          assertions: {
            ...categoryAssertions,
            "categories:performance": ["error", { minScore: 0.68 }],
          },
        },
      ],
    },
  },
};
