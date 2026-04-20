import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

test("sync-adoption-canonical-to-llms --check matches README excerpt to llms", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts", "sync-adoption-canonical-to-llms.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
