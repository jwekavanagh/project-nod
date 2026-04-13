/**
 * Integration: partner-quickstart-verify replays CLI stderr (truth report) and stdout (JSON), then tail line.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

describe("first-run-verify output (integration)", () => {
  it("replays truth report and JSON then first-run-verify tail (sqlite)", () => {
    const cli = path.join(root, "dist", "cli.js");
    assert.ok(existsSync(cli), "dist/cli.js missing — run npm run build before this test");
    const env = { ...process.env };
    delete env.PARTNER_POSTGRES_URL;
    const r = spawnSync(process.execPath, ["scripts/partner-quickstart-verify.mjs"], {
      cwd: root,
      encoding: "utf8",
      env,
    });
    assert.equal(r.status, 0, `partner-quickstart-verify stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert.ok(
      r.stderr.includes("Matched the database."),
      `expected human report phrase in stderr, got:\n${r.stderr.slice(0, 2000)}`,
    );
    assert.ok(
      r.stdout.includes('"status"') && r.stdout.includes("complete") && r.stdout.includes("verified"),
      `expected WorkflowResult JSON in stdout, got:\n${r.stdout.slice(0, 2000)}`,
    );
    const lines = r.stdout.trim().split(/\r?\n/);
    const last = lines.at(-1);
    assert.equal(last, "first-run-verify: ok (sqlite)");
  });
});
