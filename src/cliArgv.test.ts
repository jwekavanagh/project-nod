import { describe, expect, it } from "vitest";
import { CLI_OPERATIONAL_CODES } from "./failureCatalog.js";
import { parseBatchVerifyCliArgs } from "./cliArgv.js";
import { TruthLayerError } from "./truthLayerError.js";

describe("parseBatchVerifyCliArgs", () => {
  it("rejects strong consistency with --verification-window-ms (CLI_USAGE)", () => {
    const args = [
      "--workflow-id",
      "wf",
      "--events",
      "/e",
      "--registry",
      "/r",
      "--db",
      "/d",
      "--consistency",
      "strong",
      "--verification-window-ms",
      "100",
    ];
    let err: unknown;
    try {
      parseBatchVerifyCliArgs(args);
      err = undefined;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(TruthLayerError);
    expect((err as TruthLayerError).code).toBe(CLI_OPERATIONAL_CODES.CLI_USAGE);
  });
});
