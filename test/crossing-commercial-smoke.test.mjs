/**
 * One hermetic agentskeptic crossing bootstrap-led run against commercial dist + harness license mock.
 * Invoked from scripts/commercial-enforce-test-harness.mjs (not npm test by default).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const inputJson = join(root, "test", "fixtures", "bootstrap-pack", "input.json");

function spawnCli(args) {
  const prev = process.env.NODE_OPTIONS ?? "";
  const flag = "--disable-warning=ExperimentalWarning";
  const nodeOptions = prev.includes("disable-warning") ? prev : `${prev} ${flag}`.trim();
  return spawnSync(process.execPath, [cliJs, ...args], {
    encoding: "utf8",
    cwd: root,
    maxBuffer: 10_000_000,
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  });
}

describe("crossing commercial smoke (harness license mock)", () => {
  it("bootstrap-led exits 0; single WorkflowResult stdout; pack artifacts exist", () => {
    const tmp = mkdtempSync(join(tmpdir(), "crossing-commercial-"));
    try {
      const dbPath = join(tmp, "db.sqlite");
      const db = new DatabaseSync(dbPath);
      db.exec(readFileSync(join(root, "examples", "seed.sql"), "utf8"));
      db.close();
      const packOut = join(tmp, "pack");
      const r = spawnCli(["crossing", "--bootstrap-input", inputJson, "--pack-out", packOut, "--db", dbPath]);
      assert.equal(r.status, 0, r.stderr + r.stdout);
      const lines = r.stdout.trim().split(/\r?\n/).filter(Boolean);
      assert.equal(lines.length, 1);
      const wr = JSON.parse(lines[0]);
      assert.equal(wr.status, "complete");
      assert.ok(existsSync(join(packOut, "events.ndjson")));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
