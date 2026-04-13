/**
 * R1a-i / R1a-ii: emitter contract failure throws before any dist/cli.js spawn.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawnSync as realSpawnSync } from "node:child_process";
import { executeLanggraphReferencePipeline } from "../scripts/lib/langgraphReferenceVerifyCore.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("langgraph reference emitter before dist/cli spawn", () => {
  it("throws EMITTER_CONTRACT and never invokes spawnSync when contract fails", () => {
    let spawnCalls = 0;
    /** @type {typeof realSpawnSync} */
    const spawnSync = (...args) => {
      spawnCalls += 1;
      return realSpawnSync(...args);
    };

    const badPath = join(tmpdir(), `lg-emit-contract-${randomUUID()}.ndjson`);
    writeFileSync(badPath, '{"not":"valid contract"}\n', "utf8");
    try {
      assert.throws(
        () => {
          executeLanggraphReferencePipeline({ spawnSync, root, eventsPath: badPath });
        },
        (err) => err instanceof Error && err.message.startsWith("langgraph-reference-verify: EMITTER_CONTRACT"),
      );
      assert.equal(spawnCalls, 0);
    } finally {
      try {
        unlinkSync(badPath);
      } catch {
        /* ignore */
      }
    }
  });
});
