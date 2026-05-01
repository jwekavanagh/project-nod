#!/usr/bin/env node
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcJson = join(root, "website", "src", "content", "first-five-minutes.json");
const dstJson = join(root, "config", "first-five-minutes.json");
mkdirSync(dirname(dstJson), { recursive: true });
copyFileSync(srcJson, dstJson);
console.error("materialize-first-five-minutes: wrote config/first-five-minutes.json");
