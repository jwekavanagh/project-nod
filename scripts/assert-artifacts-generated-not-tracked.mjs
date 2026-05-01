#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("git", ["ls-files", "--", "artifacts/generated/"], {
  cwd: root,
  encoding: "utf8",
});
if (r.status !== 0) {
  console.error("[assert-artifacts-generated-not-tracked] git ls-files failed", r.stderr?.trim?.());
  process.exit(1);
}
const out = r.stdout.trim();
if (out.length > 0) {
  console.error("[assert-artifacts-generated-not-tracked] tracked paths under artifacts/generated/:\n" + out);
  process.exit(1);
}
console.error("assert-artifacts-generated-not-tracked: ok");
