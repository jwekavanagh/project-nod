#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildDiscoveryPayload } = require("./discovery-payload.lib.cjs");

const payload = buildDiscoveryPayload(root);
const outDir = path.join(root, "dist");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "discovery-payload-v1.json");
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
