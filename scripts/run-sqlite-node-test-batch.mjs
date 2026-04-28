#!/usr/bin/env node
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteNodeTestFiles } from "../test/suites.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = sqliteNodeTestFiles.map((f) => join(root, f).replace(/\\/g, "/")).join(" ");
execSync(`node --test --test-force-exit ${files}`, { stdio: "inherit", cwd: root, shell: true, env: process.env });
