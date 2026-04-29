import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");

describe("CLI loop", () => {
  let dir;
  let dbPath;
  let home;
  let prevHome;
  let prevUserProfile;

  const eventsPath = join(root, "examples", "events.ndjson");
  const registryPath = join(root, "examples", "tools.json");

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "etl-loop-"));
    dbPath = join(dir, "test.db");
    home = mkdtempSync(join(tmpdir(), "etl-loop-home-"));
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    process.env.HOME = home;
    if (process.platform === "win32") process.env.USERPROFILE = home;

    const sql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
    const db = new DatabaseSync(dbPath);
    db.exec(sql);
    db.close();
  });

  after(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (process.platform === "win32") {
      if (prevUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = prevUserProfile;
    }
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("first loop run prints contract and no local regression anchor", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "loop",
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--db",
        dbPath,
      ],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(r.status, 0, r.stderr);
    const out = r.stdout.replace(/\r\n/g, "\n").trimEnd().split("\n");
    assert.ok(out[0].startsWith("VERDICT: TRUSTED"));
    assert.ok(out[1].startsWith("WHY: "));
    assert.equal(out[2], "LOCAL_REGRESSION_COMPARE: no_anchor");
    assert.ok(out[3].startsWith("RUN_REF: "));
  });

  it("second compatible run auto-compares and keeps run history index", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "loop",
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--db",
        dbPath,
      ],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(r.status, 0, r.stderr);
    const out = r.stdout.replace(/\r\n/g, "\n");
    assert.ok(out.includes("LOCAL_REGRESSION_COMPARE: classification="), out);

    const indexPath = join(home, ".agentskeptic", "runs", "index.json");
    assert.equal(existsSync(indexPath), true);
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    assert.equal(index.schemaVersion, 1);
    assert.ok(Array.isArray(index.runs));
    assert.ok(index.runs.length >= 2);
  });

  it("non-trusted verdict includes NEXT_ACTION", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "loop",
        "--workflow-id",
        "wf_missing",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--db",
        dbPath,
      ],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(r.status, 1, r.stderr);
    const out = r.stdout.replace(/\r\n/g, "\n");
    assert.ok(out.includes("VERDICT: NOT TRUSTED"), out);
    assert.ok(out.includes("NEXT_ACTION: "), out);
  });
});
