#!/usr/bin/env node
/**
 * Single entry for website SSOT materialization: integrate shell, public anchors, embedded docs,
 * epistemic contract snippets, and buyer authority surfaces. Used by `website` prebuild and
 * `npm run test:vitest` (website workspace) so generated artifacts stay aligned with CI/Next build.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNode(scriptRel) {
  const r = spawnSync(process.execPath, [path.join(root, scriptRel)], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

function runNpmScript(name) {
  const r = spawnSync(`npm run ${name}`, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

runNpmScript("codegen:buyer-truth");
runNode("scripts/generate-integrate-activation-shell.mjs");
runNpmScript("sync:public-product-anchors");
runNode("scripts/sync-integrator-docs-embedded.mjs");
runNode("scripts/sync-epistemic-contract-website.mjs");
runNode("scripts/sync-buyer-authority-surfaces.mjs");
runNode("scripts/sync-contract-manifest-static.mjs");
