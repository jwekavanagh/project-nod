import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fenceInner(content, begin, end) {
  const i = content.indexOf(begin);
  const j = content.indexOf(end);
  assert.ok(i >= 0, `missing begin: ${begin}`);
  assert.ok(j > i, `missing or invalid end: ${end}`);
  return content.slice(i + begin.length, j).trim();
}

test("commercial SSOT buyer fence has required headings and evaluation prose", () => {
  const c = readFileSync(join(root, "docs", "commercial-ssot.md"), "utf8");
  const inner = fenceInner(
    c,
    "<!-- buyer-surface-commercial-boundary:begin -->",
    "<!-- buyer-surface-commercial-boundary:end -->",
  );
  assert.match(inner, /## Commercial boundary/);
  assert.match(inner, /## Evaluation path/);
  assert.match(inner, /\/integrate/);
  assert.match(inner, /\/pricing/);
});

test("CI enforcement buyer fence has required heading", () => {
  const c = readFileSync(join(root, "docs", "ci-enforcement.md"), "utf8");
  const inner = fenceInner(
    c,
    "<!-- buyer-surface-ci-enforcement-metering:begin -->",
    "<!-- buyer-surface-ci-enforcement-metering:end -->",
  );
  assert.match(inner, /## CI enforcement and metering/);
});

test("verification product SSOT buyer fence has required heading", () => {
  const c = readFileSync(join(root, "docs", "verification-product-ssot.md"), "utf8");
  const inner = fenceInner(
    c,
    "<!-- buyer-surface-trust-production-implications:begin -->",
    "<!-- buyer-surface-trust-production-implications:end -->",
  );
  assert.match(inner, /## Trust and production implications/);
});

test("synced buyer guides include What to do next", () => {
  for (const slug of [
    "buyer-commercial-boundary",
    "buyer-ci-enforcement-metering",
    "buyer-trust-production-implications",
  ]) {
    const p = join(root, "website", "content", "surfaces", "guides", `${slug}.md`);
    const raw = readFileSync(p, "utf8");
    assert.match(raw, /^---\r?\n/m);
    assert.match(raw, /## What to do next/);
  }
});
