#!/usr/bin/env node
/**
 * Validates buyer-truth: schema, commercial.md anchor, codegen freshness, Vitest projection parity.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = process.platform === "win32" ? "git.exe" : "git";

function runNode(scriptRel) {
  const r = spawnSync(process.execPath, [join(rootDir, scriptRel)], {
    cwd: rootDir,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

function runNpm(script) {
  const r = spawnSync(`npm run ${script}`, { cwd: rootDir, shell: true, stdio: "inherit" });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

runNode("scripts/validate-buyer-truth-schema.mjs");
runNode("scripts/assert-buyer-truth-aligns-commercial-md.mjs");
runNpm("codegen:buyer-truth");

const diff = spawnSync(
  git,
  [
    "diff",
    "--exit-code",
    "HEAD",
    "--",
    "website/src/generated/buyerTruthProjection.snap.json",
    "website/src/generated/buyerTruthCodegenHash.ts",
    "README.md",
  ],
  { cwd: rootDir, stdio: "inherit" },
);
if (diff.status === 1) {
  console.error(
    "check-buyer-truth: generated files or README differ from HEAD — run `npm run codegen:buyer-truth` and commit.",
  );
  process.exit(1);
}
if (diff.status !== 0) {
  process.exit(diff.status === null ? 2 : diff.status);
}

const vitest = spawnSync(`npx vitest run __tests__/buyer-truth.projection-parity.test.ts`, {
  cwd: join(rootDir, "website"),
  shell: true,
  stdio: "inherit",
});
if (vitest.status !== 0) {
  process.exit(vitest.status === null ? 1 : vitest.status);
}

console.error("check-buyer-truth: ok");
