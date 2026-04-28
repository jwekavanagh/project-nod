/**
 * Contract manifest integrity: live member/example hashes match history[last];
 * recomputed canonical manifest hash matches the sealed value.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const manifest = JSON.parse(readFileSync(join(root, "schemas", "contract", "v1.json"), "utf8"));
const head = manifest.history[manifest.history.length - 1];

/** Must match `sha256OfFile` in scripts/contract-manifest.mjs */
function sha256OfFile(rel) {
  const abs = join(root, rel);
  const raw = readFileSync(abs);
  const lower = abs.replace(/\\/g, "/").toLowerCase();
  const isText =
    lower.endsWith(".json") || lower.endsWith(".ndjson") || lower.endsWith(".yaml") || lower.endsWith(".yml");
  const buf = isText
    ? Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8")
    : raw;
  return createHash("sha256").update(buf).digest("hex");
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

function canonicalize(value) {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

describe("contract-manifest hash", () => {
  it("live member hashes equal history[last].memberSha256", () => {
    for (const [role, member] of Object.entries(manifest.members)) {
      const live = sha256OfFile(member.schemaPath);
      assert.equal(live, head.memberSha256[role], `member ${role} hash drift`);
    }
  });

  it("live example hashes equal history[last].exampleSha256", () => {
    for (const [role, example] of Object.entries(manifest.examples)) {
      const live = sha256OfFile(example.path);
      assert.equal(live, head.exampleSha256[role], `example ${role} hash drift`);
    }
  });

  it("manifest canonical sha256 (with head.manifestSha256 zeroed) equals sealed value", () => {
    const clone = JSON.parse(JSON.stringify(manifest));
    clone.history[clone.history.length - 1].manifestSha256 = "";
    const recomputed = createHash("sha256")
      .update(Buffer.from(canonicalize(clone), "utf8"))
      .digest("hex");
    assert.equal(recomputed, head.manifestSha256);
  });

  it("history is strictly ascending semver", () => {
    for (let i = 1; i < manifest.history.length; i++) {
      const prev = manifest.history[i - 1].manifestVersion.split(".").map(Number);
      const cur = manifest.history[i].manifestVersion.split(".").map(Number);
      let cmp = 0;
      for (let k = 0; k < 3; k++) {
        if (cur[k] > prev[k]) {
          cmp = 1;
          break;
        }
        if (cur[k] < prev[k]) {
          cmp = -1;
          break;
        }
      }
      assert.equal(cmp, 1, `history[${i}] not strictly greater than history[${i - 1}]`);
    }
  });

  it("top-level manifestVersion equals history[last].manifestVersion", () => {
    assert.equal(manifest.manifestVersion, head.manifestVersion);
  });
});
