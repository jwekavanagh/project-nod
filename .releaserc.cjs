const commitAnalyzerRules = require("./release/commit-analyzer-rules.cjs");

module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", commitAnalyzerRules],
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
        provenance: true,
        pkgRoot: ".",
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "node scripts/sync-release-artifacts.mjs",
      },
    ],
    [
      "@semantic-release/git",
      {
        message:
          "chore(release): ${nextRelease.version}\n\nAutomated version bump, changelog, and distribution sync (semantic-release).",
        assets: [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json",
          "AGENTS.md",
          "README.md",
          "llms.txt",
          "python/pyproject.toml",
          "website/package.json",
          "src/publicDistribution.generated.ts",
          "schemas/openapi-commercial-v1.yaml",
        ],
      },
    ],
    [
      "@semantic-release/github",
      {
        successComment: false,
        failComment: false,
      },
    ],
  ],
};
