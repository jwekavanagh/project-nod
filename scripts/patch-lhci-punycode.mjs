/**
 * @lhci/cli → isomorphic-fetch → node-fetch@2 → whatwg-url@5 + tr46@0.0.3
 * use Node's deprecated built-in `punycode` (DEP0040). Prefer the userland
 * package via `require("punycode/")` (same approach as modern tr46).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  [
    path.join(
      root,
      "node_modules/isomorphic-fetch/node_modules/whatwg-url/lib/url-state-machine.js",
    ),
    'const punycode = require("punycode");',
    'const punycode = require("punycode/");',
  ],
  [
    path.join(
      root,
      "node_modules/isomorphic-fetch/node_modules/tr46/index.js",
    ),
    'var punycode = require("punycode");',
    'var punycode = require("punycode/");',
  ],
];

for (const [file, from, to] of targets) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(from)) continue;
  if (src.includes(to)) continue;
  fs.writeFileSync(file, src.replace(from, to), "utf8");
}
