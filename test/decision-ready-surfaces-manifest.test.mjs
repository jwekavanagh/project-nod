import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

test("decision-ready-surfaces.json manifest", () => {
  const raw = readFileSync(join(root, "test/fixtures/decision-ready-surfaces.json"), "utf8");
  const doc = JSON.parse(raw);
  if (doc.__fixtureId !== "decision-ready-surfaces-v1") {
    throw new Error(`unexpected __fixtureId: ${doc.__fixtureId}`);
  }
  const { surfaces } = doc;
  if (!Array.isArray(surfaces) || surfaces.length !== 22) {
    throw new Error(`expected 22 surfaces, got ${surfaces?.length}`);
  }
  for (const row of surfaces) {
    const body = readFileSync(join(root, row.repoRelativePath), "utf8");
    if (!body.includes(row.mustContain)) {
      throw new Error(`missing mustContain in ${row.repoRelativePath}: ${row.mustContain}`);
    }
  }
});
