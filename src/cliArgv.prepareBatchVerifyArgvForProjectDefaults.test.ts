import path from "node:path";
import { describe, expect, it } from "vitest";
import { TruthLayerError } from "./truthLayerError.js";
import {
  prepareBatchVerifyArgvForProjectDefaults,
  expandTruthCheckCliArgs,
} from "./cliArgv.js";

describe("prepareBatchVerifyArgvForProjectDefaults", () => {
  it("inject conventional registry/events when --project set", () => {
    const inp = ["--workflow-id", "wf1", "--project", "./myproj", "--db", "db.sqlite"];
    const out = prepareBatchVerifyArgvForProjectDefaults(inp);
    const projAbs = path.resolve("./myproj");
    expect(out).toStrictEqual([
      "--workflow-id",
      "wf1",
      "--project",
      "./myproj",
      "--db",
      "db.sqlite",
      "--registry",
      path.join(projAbs, "agentskeptic", "tools.json"),
      "--events",
      path.join(projAbs, "agentskeptic", "events.ndjson"),
    ]);
  });

  it("does not override explicit --registry/--events when --project set", () => {
    const reg = "/abs/custom-registry.json";
    const ev = "/abs/custom-events.ndjson";
    const inp = [
      "--workflow-id",
      "wf1",
      "--project",
      "./p",
      "--registry",
      reg,
      "--events",
      ev,
      "--db",
      "d.db",
    ];
    const out = prepareBatchVerifyArgvForProjectDefaults(inp);
    expect(out).toStrictEqual(inp);
  });

  it("noop when --project absent", () => {
    const inp = ["--workflow-id", "wf1", "--events", "e.ndjson", "--registry", "r.json", "--db", "d.db"];
    expect(prepareBatchVerifyArgvForProjectDefaults(inp)).toStrictEqual(inp);
  });

  it("requires --workflow-id when --project set", () => {
    expect(() => prepareBatchVerifyArgvForProjectDefaults(["--project", "./p", "--db", "x.db"])).toThrow(
      TruthLayerError,
    );
  });

  it("expandTruthCheckCliArgs still appends internal check flag after injection", () => {
    const out = expandTruthCheckCliArgs(["--workflow-id", "wf1", "--project", "./proj", "--db", "a.db"]);
    expect(out[out.length - 1]).toBe("--internal-invoked-via-check");
    const projAbs = path.resolve("./proj");
    expect(out).toContain(path.join(projAbs, "agentskeptic", "tools.json"));
    expect(out).toContain(path.join(projAbs, "agentskeptic", "events.ndjson"));
  });
});
