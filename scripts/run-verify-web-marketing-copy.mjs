#!/usr/bin/env node
/**
 * Runs `npm run verify:web-marketing-copy` steps with `NEXT_PUBLIC_APP_URL` pinned to
 * `productionCanonicalOrigin` so `next build` inlines the same public URLs CI expects
 * (distribution-graph, OpenAPI hrefs) even when `website/.env` uses loopback for dev.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const anchors = JSON.parse(
  readFileSync(path.join(root, "config", "public-product-anchors.json"), "utf8"),
);
const canonical = new URL(String(anchors.productionCanonicalOrigin).trim()).origin;

const env = { ...process.env, NEXT_PUBLIC_APP_URL: canonical };

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit", shell: true });
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  const code = r.status === null ? 1 : r.status;
  if (code !== 0) process.exit(code);
}

run(process.execPath, [path.join(root, "scripts", "validate-discovery-acquisition.mjs")]);
run(process.execPath, ["--test", path.join(root, "test", "visitor-problem-outcome.test.mjs")]);
run("npm", ["run", "build", "-w", "agentskeptic-web"]);
run(process.execPath, [path.join(root, "scripts", "run-website-vitest-with-reuse.mjs")]);
run(process.execPath, [path.join(root, "scripts", "website-holistic-gate.mjs")]);
