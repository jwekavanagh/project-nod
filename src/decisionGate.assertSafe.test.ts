import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDecisionGateImpl } from "./decisionGate.js";
import { TrustDecisionBlockedError } from "./trustDecisionBlockedError.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("DecisionGate.assertSafeForIrreversibleAction", () => {
  /** Seeded SQLite under tmp — `examples/demo.db` is gitignored and absent on clean CI. */
  let workDir: string;
  let dbPath: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "agentskeptic-assert-safe-"));
    dbPath = join(workDir, "demo.db");
    const sql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
    const db = new DatabaseSync(dbPath);
    db.exec(sql);
    db.close();
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("throws TrustDecisionBlockedError when DB does not match (wf_missing)", async () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
    const lines = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    const gate = createDecisionGateImpl({
      workflowId: "wf_missing",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: () => {},
      truthReport: () => {},
    });
    for (const line of lines) {
      const ev = JSON.parse(line) as { workflowId?: string };
      if (ev.workflowId === "wf_missing") {
        gate.appendRunEvent(ev);
      }
    }
    await expect(gate.assertSafeForIrreversibleAction()).rejects.toSatisfy((e: unknown) => {
      if (!(e instanceof TrustDecisionBlockedError)) return false;
      if (e.trustDecision !== "unsafe") return false;
      return e.message.split("\n").length === 6;
    });
  });
});
