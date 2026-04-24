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
      assertions: {
        "categories:performance": ["error", { minScore: 0.68 }],
        "categories:accessibility": ["error", { minScore: 0.96 }],
        "categories:best-practices": ["error", { minScore: 0.96 }],
        "categories:seo": ["error", { minScore: 0.96 }],
      },
    },
  },
};
