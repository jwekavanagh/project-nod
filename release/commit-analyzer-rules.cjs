/**
 * Shared options for @semantic-release/commit-analyzer.
 * Used by .releaserc.cjs and scripts/release-preview.mjs (must stay identical).
 *
 * Explicit Conventional Commits preset (not Angular defaults):
 * `feat!:`, `fix!`, footer `BREAKING CHANGE:` and related rules match integrator/GitHub squash practice.
 *
 * Regression: `test/commit-analyzer-rules.test.mjs`.
 */
module.exports = {
  preset: "conventionalcommits",
};
