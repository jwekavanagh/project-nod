import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDecisionGate } from "./decisionGate.js";
import { DecisionUnsafeError } from "./decisionUnsafeError.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");

describe("DecisionGate.assertSafeForIrreversibleAction", () => {
  it("throws DecisionUnsafeError when DB does not match (wf_missing)", async () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
    const dbPath = join(root, "examples", "demo.db");
    const lines = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    const gate = createDecisionGate({
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
      if (!(e instanceof DecisionUnsafeError)) return false;
      if (e.trustDecision !== "unsafe") return false;
      return e.message.split("\n").length === 6;
    });
  });
});
