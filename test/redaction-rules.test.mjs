/**
 * Redaction reference implementation (scripts/redaction-rules.cjs).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);
const { applyRedactionWalk, redactString } = require(join(root, "scripts", "redaction-rules.cjs"));

test("redactString removes Bearer, sk-, email, and long strings", () => {
  assert.equal(redactString("Bearer secret-token"), "[REDACTED_BEARER]");
  assert.match(redactString("prefix sk-abcdefghijklmnopqrstuvwxyz1234567890 suffix"), /\[REDACTED_SK\]/);
  assert.equal(redactString("mail me at user@example.com please"), "mail me at [REDACTED_EMAIL] please");
  const long = "x".repeat(241);
  assert.equal(redactString(long), "[REDACTED_LONG_STRING_LEN_241]");
});

test("applyRedactionWalk on fixture", () => {
  const raw = JSON.parse(readFileSync(join(root, "test", "fixtures", "redaction-before.json"), "utf8"));
  const out = applyRedactionWalk(raw);
  const s = JSON.stringify(out);
  assert.ok(!s.includes("Bearer"));
  assert.ok(!s.includes("sk-test"));
  assert.ok(!s.includes("example.com"));
  assert.equal(out.short, "ok");
});
