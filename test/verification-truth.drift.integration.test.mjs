/**
 * Verification-truth lifecycle checks (destructive drift tests omitted where regen restores files before diff).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const verifier = join(root, "scripts", "verification-truth.mjs");

describe("verification-truth process contract", () => {
  it("exits non-zero without DATABASE_URL / TELEMETRY_DATABASE_URL", () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.TELEMETRY_DATABASE_URL;
    const r = spawnSync(process.execPath, [verifier], {
      cwd: root,
      encoding: "utf8",
      env,
    });
    assert.notEqual(r.status, 0);
    const out = `${r.stderr ?? ""}${r.stdout ?? ""}`;
    assert.ok(out.includes("[verification-truth:postgres]"));
    assert.ok(out.includes("DATABASE_URL"));
  });
});
