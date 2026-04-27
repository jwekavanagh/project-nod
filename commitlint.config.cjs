/** @type {import("@commitlint/types").UserConfig} */
const mergeFromGithub = (message) =>
  typeof message === "string" && message.startsWith("Merge pull request ");

/** @returns {string} */
function firstLine(message) {
  if (typeof message !== "string") return "";
  return message.split("\n")[0].trim();
}

// If the header looks like a Conventional Commit, apply full @commitlint/config-conventional rules.
// If not (e.g. Cursor/IDE one-line summaries), do not run those rules so local commits are not blocked.
// Pattern: type(optional scope)(optional !): subject  — must not require `!` before `:`.
function looksConventionalHeader(message) {
  const line = firstLine(message);
  if (mergeFromGithub(message) || !line) return false;
  return /^[a-z]+(\([a-z0-9._/-]+\))?(!)?: .+/.test(line);
}

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Cursor and other IDEs often generate long wrapped bullets. Keep conventional headers strict,
    // but do not block on body line width.
    "body-max-line-length": [0],
  },
  ignores: [
    mergeFromGithub,
    (message) => {
      if (typeof message !== "string") return false;
      const line = firstLine(message);
      return line.length > 0 && !looksConventionalHeader(message);
    },
  ],
};
