/**
 * `npm` (pulled in by @semantic-release/npm) bundles `ip-address@10.1.0`, which
 * is below the XSS fix in 10.1.1 (GHSA-v2v4-37r5-5v8g). Root `overrides` hoist
 * 10.1.1 for normal dependency trees but do not replace npm's bundled copy.
 * After install, mirror the hoisted package into npm's nested path so audit
 * and runtime match the patched release.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules/ip-address");
const dest = path.join(root, "node_modules/npm/node_modules/ip-address");

if (!fs.existsSync(src) || !fs.existsSync(dest)) {
  process.exit(0);
}

const readVer = (dir) =>
  JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;

if (readVer(src) === readVer(dest)) {
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
