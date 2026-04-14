import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = "test/fixtures/quick-param-pointer/pointer-promotion.sqlite";
const FILES = [
  "src/quickVerify/quickParamPointerPromotionGoldens.test.ts",
  "src/quickVerify/quickParamPointerReplay.test.ts",
  "src/quickVerify/quickParamPointerNegatives.test.ts",
  "src/quickVerify/planRowUnit.pointer-promotion.test.ts",
];

const FORBIDDEN = ["examples/demo.db", "examples\\demo.db", "qv-gate-", ":memory:"];

export function assertQuickParamPointerDbPaths(root) {
  for (const rel of FILES) {
    const text = readFileSync(join(root, rel), "utf8");
    assert.ok(text.includes(ALLOWED), `${rel} must reference ${ALLOWED}`);
    for (const f of FORBIDDEN) {
      assert.equal(text.includes(f), false, `${rel} must not contain ${f}`);
    }
    const n1 = (text.match(/\.sqlite/g) ?? []).length;
    const n2 = (text.match(new RegExp(ALLOWED.replace(/\\/g, "\\\\"), "g")) ?? []).length;
    assert.equal(n2, n1, `${rel}: .sqlite count must equal allowed path count`);
  }
}
