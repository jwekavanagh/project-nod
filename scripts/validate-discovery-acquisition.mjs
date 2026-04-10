#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  require("./discovery-acquisition.lib.cjs").validateDiscoveryAcquisition(root);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
