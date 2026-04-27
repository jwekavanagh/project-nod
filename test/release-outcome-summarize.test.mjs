import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "release-outcome-summarize.mjs");

function runSummarize(logContent, exitCode) {
  const dir = mkdtempSync(join(tmpdir(), "rsum-"));
  try {
    const logPath = join(dir, "semantic-release.log");
    writeFileSync(logPath, logContent, "utf8");
    const r = spawnSync(process.execPath, [script, "--log", logPath, "--exit-code", String(exitCode)], {
      encoding: "utf8",
    });
    return { stdout: r.stdout, status: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("release-outcome-summarize.mjs", () => {
  it("classifies no relevant changes as SKIPPED_NO_RELEASABLE_COMMITS", () => {
    const log = readFileSync(join(root, "test", "fixtures", "release-outcome", "no-changes.log"), "utf8");
    const { stdout, status } = runSummarize(log, 0);
    assert.equal(status, 0);
    assert.match(stdout, /RELEASE_OUTCOME=SKIPPED_NO_RELEASABLE_COMMITS/);
  });

  it("classifies published line as CREATED", () => {
    const log = readFileSync(join(root, "test", "fixtures", "release-outcome", "published.log"), "utf8");
    const { stdout, status } = runSummarize(log, 0);
    assert.equal(status, 0);
    assert.match(stdout, /RELEASE_OUTCOME=CREATED/);
  });

  it("classifies non-zero exit as FAILED", () => {
    const { stdout, status } = runSummarize("some error\n", 1);
    assert.equal(status, 0);
    assert.match(stdout, /RELEASE_OUTCOME=FAILED/);
    assert.match(stdout, /Log excerpt/);
  });

  it("source file contains RELEASE_OUTCOME= contract substring", () => {
    const src = readFileSync(script, "utf8");
    assert.ok(src.includes("RELEASE_OUTCOME="));
  });
});
