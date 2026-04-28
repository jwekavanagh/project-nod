#!/usr/bin/env node
/**
 * Runs the Postgres workflow-truth contract suite (path lives here, not in package.json).
 */
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testFile = join(root, "test", "ci-workflow-truth-postgres-contract.test.mjs");
execSync(`node --test --test-force-exit "${testFile.replace(/\\/g, "/")}"`, {
  stdio: "inherit",
  cwd: root,
  shell: true,
  env: process.env,
});
