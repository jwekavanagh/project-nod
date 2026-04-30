import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(new URL(import.meta.url, "file:")));

describe("hosted enforce CLI response shape", () => {
  it("runStateful enforce prints envelope with schemaVersion 2 for hosted payloads", () => {
    const src = readFileSync(join(root, "..", "src", "enforceStateful.ts"), "utf8");
    assert.ok(
      src.includes("schemaVersion: 2, enforce: stateRes.body"),
      "enforce stdout envelope must advertise schemaVersion 2 for hosted bodies",
    );
  });

  it("accept drift mode documents required env concurrency fields", () => {
    const src = readFileSync(join(root, "..", "src", "enforceStateful.ts"), "utf8");
    assert.ok(
      src.includes("AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH") &&
        src.includes("AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION"),
      "--accept-drift must document env pinning for lifecycle_state_version + expected projection hash",
    );
  });

  it("maps hosted drift-ish outcomes to CLI exit code 4", () => {
    const src = readFileSync(join(root, "..", "src", "enforceStateful.ts"), "utf8");
    assert.ok(
      src.includes('resultStatus === "drift"') && src.includes('resultStatus === "rerun_fail"'),
      "enforce must treat drift + rerun_fail as hosted lock-style outcomes for exit routing",
    );
  });
});
