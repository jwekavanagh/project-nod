import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyWorkflow } from "../pipeline.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dbPath = join(root, "test/fixtures/quick-param-pointer/pointer-promotion.sqlite");
const reg = join(root, "test/golden/quick-param-pointer/v1/export.tools.json");
const ev = join(root, "test/golden/quick-param-pointer/v1/contract.events.ndjson");

describe("quick param pointer workflow replay", () => {
  it("replays committed registry + events against fixture sqlite", async () => {
    const res = await verifyWorkflow({
      workflowId: "quick-verify",
      eventsPath: ev,
      registryPath: reg,
      database: { kind: "sqlite", path: dbPath },
    });
    const golden = JSON.parse(
      readFileSync(join(root, "test/golden/quick-param-pointer/v1/workflow-replay.json"), "utf8"),
    );
    expect(res.workflowTruthReport.workflowStatus).toBe(golden.workflowStatus);
    expect(res.workflowTruthReport.steps.length).toBe(golden.stepCount);
  });
});
