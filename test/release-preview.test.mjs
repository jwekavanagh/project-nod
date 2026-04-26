/**
 * Hermetic tests for scripts/release-preview.mjs using --repository-root temp git repos.
 */
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, it } from "node:test";

const agentskepticRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(agentskepticRoot, "scripts", "release-preview.mjs");
const pathsFixture = readFileSync(
  join(agentskepticRoot, "release", "preview-enforcement.paths.json"),
  "utf8",
);
const analyzerFixture = readFileSync(
  join(agentskepticRoot, "release", "commit-analyzer-rules.cjs"),
  "utf8",
);

function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

function seedRepoLayout(repo) {
  mkdirSync(join(repo, "release"), { recursive: true });
  writeFileSync(join(repo, "release", "preview-enforcement.paths.json"), pathsFixture, "utf8");
  writeFileSync(join(repo, "release", "commit-analyzer-rules.cjs"), analyzerFixture, "utf8");
}

function runPreview(repo, eventObj) {
  const eventPath = join(repo, "event.json");
  writeFileSync(eventPath, JSON.stringify(eventObj), "utf8");
  return spawnSync(process.execPath, [script, "--event", eventPath, "--repository-root", repo], {
    encoding: "utf8",
    cwd: agentskepticRoot,
  });
}

describe("scripts/release-preview.mjs", () => {
  it("OUTSIDE_ENFORCEMENT_LIST when diff touches no allowlisted paths", () => {
    const repo = mkdtempSync(join(tmpdir(), "rp-out-"));
    try {
      seedRepoLayout(repo);
      git(repo, ["init", "-b", "main"]);
      git(repo, ["config", "user.email", "t@test"]);
      git(repo, ["config", "user.name", "t"]);
      writeFileSync(join(repo, "orphan-notes.txt"), "n", "utf8");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-m", "chore: init"]);
      const base = git(repo, ["rev-parse", "HEAD"]);
      writeFileSync(join(repo, "orphan-notes.txt"), "n2", "utf8");
      git(repo, ["add", "orphan-notes.txt"]);
      git(repo, ["commit", "-m", "chore: bump"]);
      const head = git(repo, ["rev-parse", "HEAD"]);

      const r = runPreview(repo, {
        pull_request: {
          title: "docs: irrelevant title",
          body: "",
          base: { sha: base },
          head: { sha: head },
        },
      });
      assert.equal(r.status, 0, r.stderr);
      const j = JSON.parse(r.stdout.trim());
      assert.equal(j.verdict, "OUTSIDE_ENFORCEMENT_LIST");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("NOT_RELEASABLE when allowlisted diff and non-releasable squash message", () => {
    const repo = mkdtempSync(join(tmpdir(), "rp-block-"));
    try {
      seedRepoLayout(repo);
      git(repo, ["init", "-b", "main"]);
      git(repo, ["config", "user.email", "t@test"]);
      git(repo, ["config", "user.name", "t"]);
      mkdirSync(join(repo, "src"), { recursive: true });
      writeFileSync(join(repo, "src", "x.txt"), "1", "utf8");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-m", "chore: init"]);
      const base = git(repo, ["rev-parse", "HEAD"]);
      writeFileSync(join(repo, "src", "x.txt"), "2", "utf8");
      git(repo, ["add", "src/x.txt"]);
      git(repo, ["commit", "-m", "chore: bump"]);
      const head = git(repo, ["rev-parse", "HEAD"]);

      const r = runPreview(repo, {
        pull_request: {
          title: "docs: tweak",
          body: "",
          base: { sha: base },
          head: { sha: head },
        },
      });
      assert.equal(r.status, 1, r.stderr);
      const j = JSON.parse(r.stdout.trim());
      assert.equal(j.verdict, "NOT_RELEASABLE");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("RELEASABLE when allowlisted diff and fix title", () => {
    const repo = mkdtempSync(join(tmpdir(), "rp-ok-"));
    try {
      seedRepoLayout(repo);
      git(repo, ["init", "-b", "main"]);
      git(repo, ["config", "user.email", "t@test"]);
      git(repo, ["config", "user.name", "t"]);
      mkdirSync(join(repo, "src"), { recursive: true });
      writeFileSync(join(repo, "src", "x.txt"), "1", "utf8");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-m", "chore: init"]);
      const base = git(repo, ["rev-parse", "HEAD"]);
      writeFileSync(join(repo, "src", "x.txt"), "2", "utf8");
      git(repo, ["add", "src/x.txt"]);
      git(repo, ["commit", "-m", "chore: bump"]);
      const head = git(repo, ["rev-parse", "HEAD"]);

      const r = runPreview(repo, {
        pull_request: {
          title: "fix: correct preview gate",
          body: "",
          base: { sha: base },
          head: { sha: head },
        },
      });
      assert.equal(r.status, 0, r.stderr);
      const j = JSON.parse(r.stdout.trim());
      assert.equal(j.verdict, "RELEASABLE");
      assert.equal(j.releaseType, "patch");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
