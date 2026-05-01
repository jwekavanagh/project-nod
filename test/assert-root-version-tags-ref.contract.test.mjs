/**
 * Sanity check for CI tag/metadata script.
 */
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "assert-root-version-tags-ref.mjs");

function run(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(script, [], {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      silent: true,
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (c) => {
      out += c;
    });
    child.stderr?.on("data", (c) => {
      err += c;
    });
    child.on("close", (code) => resolve({ code, out, err }));
    child.on("error", reject);
  });
}

describe("assert-root-version-tags-ref.mjs", () => {
  it("exits 0 when GITHUB_REF_NAME matches package.json (with leading v)", async () => {
    const pj = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const v = pj.version;
    const r = await run({ GITHUB_REF_NAME: `v${v}` });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out + r.err, /ok package\.json=/);
  });

  it("exits non-zero when tag version mismatches package.json", async () => {
    const r = await run({ GITHUB_REF_NAME: "v0.0.0-not-real-tag" });
    assert.notEqual(r.code, 0);
  });
});
