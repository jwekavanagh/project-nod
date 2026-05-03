import { describe, expect, it } from "vitest";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { TruthLayerError } from "../truthLayerError.js";
import { renderLoopOperationalUnknown } from "./loopOutput.js";

describe("renderLoopOperationalUnknown", () => {
  it("CLI_USAGE matches disposition WHY + fix_cli_usage NEXT_ACTION", () => {
    const err = new TruthLayerError(CLI_OPERATIONAL_CODES.CLI_USAGE, "test-cli-usage");
    const out = renderLoopOperationalUnknown({
      code: err.code,
      message: err.message,
      runRef: "unavailable",
    });
    expect(out).toBe(
      [
        "VERDICT: UNKNOWN",
        "WHY: Invalid or incomplete CLI arguments for agentskeptic.",
        "LOCAL_REGRESSION_COMPARE: no_anchor",
        "NEXT_ACTION: Fix CLI flags or paths (events, registry, database URL), then rerun verify.",
        "RUN_REF: unavailable",
      ].join("\n"),
    );
  });
});
