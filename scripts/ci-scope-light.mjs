/**
 * Decides whether GitHub Actions should use the lightweight CI path for this event.
 * PRs and non–release pushes keep full CI; release tags (`refs/tags/v*`) and semantic-release's
 * `chore(release):` commits on main use light CI (heavy jobs skipped; product_gate runs checks).
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {{ eventName?: string; ref?: string; head_commit?: { message?: string | null } | null }}} event github context-style event subset
 */
export function shouldUseLightCiPath(event) {
  const eventName = String(event.eventName ?? "");
  if (eventName === "pull_request") {
    return false;
  }
  if (eventName !== "push") {
    return false;
  }

  const ref = String(event.ref ?? "");
  if (ref.startsWith("refs/tags/v")) {
    return true;
  }

  if (ref === "refs/heads/main") {
    const msgRaw = event.head_commit?.message;
    if (msgRaw == null || typeof msgRaw !== "string") {
      return false;
    }
    const firstLine = msgRaw.split(/\r?\n/).at(0)?.trim() ?? "";
    return firstLine.startsWith("chore(release):");
  }

  return false;
}

/**
 * Loads event from GitHub Actions GITHUB_EVENT_PATH and appends mode to GITHUB_OUTPUT.
 */
export function emitGitHubOutput() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const outPath = process.env.GITHUB_OUTPUT;
  if (!eventPath || !outPath) {
    console.error("ci-scope-light: GITHUB_EVENT_PATH and GITHUB_OUTPUT must be set");
    process.exit(1);
  }
  const gh = JSON.parse(readFileSync(eventPath, "utf8"));
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";
  const ref = process.env.GITHUB_REF ?? "";
  const head_commit =
    gh.head_commit && typeof gh.head_commit === "object" ? gh.head_commit : null;
  const light = shouldUseLightCiPath({
    eventName,
    ref,
    head_commit,
  });
  const mode = light ? "light" : "full";
  appendFileSync(outPath, `mode=${mode}\n`, { encoding: "utf8" });
  console.log(`ci-scope-light: mode=${mode}`);
}

const entryMaybe = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryMaybe && import.meta.url === entryMaybe) {
  emitGitHubOutput();
}
