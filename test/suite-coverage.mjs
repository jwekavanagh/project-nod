/**
 * Every top-level `test/*.mjs` (except `suites.mjs` and `*.lib.mjs`) is classified
 * in test/suites.mjs into sqlite, postgres, commercialHarness, commercialPostgresHarness,
 * nodeTestScheduledByVerificationTruth, or mjsAtTestRootRunByVerificationTruthOnly.
 */
import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sqliteNodeTestFiles,
  postgresNodeTestFiles,
  commercialHarnessNodeTestFiles,
  commercialPostgresHarnessNodeTestFiles,
  nodeTestScheduledByVerificationTruth,
  mjsAtTestRootRunByVerificationTruthOnly,
} from "./suites.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function rel(p) {
  return p.replace(/\\/g, "/");
}

function basenamePath(rootRel) {
  return rootRel.replace(/^test\//, "");
}

describe("test/suites.mjs coverage (exhaustive, disjoint)", () => {
  it("sqlite, postgres, commercialHarness, and commercialPostgresHarness are pairwise disjoint", () => {
    const a = new Set(sqliteNodeTestFiles);
    const b = new Set(postgresNodeTestFiles);
    const c = new Set(commercialHarnessNodeTestFiles);
    const d = new Set(commercialPostgresHarnessNodeTestFiles);
    const sets = [
      ["sqlite", a],
      ["postgres", b],
      ["commercialHarness", c],
      ["commercialPostgresHarness", d],
    ];
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const pairI = sets[i];
        const pairJ = sets[j];
        if (!pairI || !pairJ) continue;
        const [ni, si] = pairI;
        const [nj, sj] = pairJ;
        for (const p of si) {
          assert.equal(sj.has(p), false, `${ni} ∩ ${nj}: ${p}`);
        }
      }
    }
  });

  it("no duplicate entries within sqlite, postgres, commercialHarness, or commercialPostgresHarness", () => {
    for (const [name, arr] of [
      ["sqlite", sqliteNodeTestFiles],
      ["postgres", postgresNodeTestFiles],
      ["commercialHarness", commercialHarnessNodeTestFiles],
      ["commercialPostgresHarness", commercialPostgresHarnessNodeTestFiles],
    ]) {
      const s = new Set();
      for (const p of arr) {
        assert.equal(s.has(p), false, `duplicate in ${name}: ${p}`);
        s.add(p);
      }
    }
  });

  it("top-level test/*.mjs (excluding data + libs) is fully classified", async () => {
    const testDir = __dirname;
    const top = (await readdir(testDir))
      .filter((f) => f.endsWith(".mjs") && f !== "suites.mjs" && !f.endsWith(".lib.mjs"))
      .map((f) => rel(join("test", f)));

    const reg = new Set([
      ...sqliteNodeTestFiles,
      ...postgresNodeTestFiles,
      ...commercialHarnessNodeTestFiles,
      ...commercialPostgresHarnessNodeTestFiles,
      ...nodeTestScheduledByVerificationTruth,
      ...mjsAtTestRootRunByVerificationTruthOnly,
    ]);

    for (const p of top) {
      assert.equal(reg.has(p), true, `unclassified: ${p} — add to test/suites.mjs`);
    }

    for (const p of reg) {
      assert.equal(
        p.startsWith("test/"),
        true,
        `registry paths must be test/... got ${p}`,
      );
    }

    for (const p of reg) {
      const filePath = join(testDir, basenamePath(p));
      const st = await stat(filePath);
      assert.equal(st.isFile(), true, `registry path not a file: ${p}`);
    }
  });
});
