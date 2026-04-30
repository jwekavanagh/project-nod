import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const enforcementApiRoot = join(__dirname, "../src/app/api/v1/enforcement");

describe("enforcement API routes avoid legacy write authority", () => {
  for (const rel of ["check/route.ts", "baselines/route.ts", "accept/route.ts"] as const) {
    it(`${rel} does not import legacy upsertBaseline or appendEnforcementEvent`, () => {
      const src = readFileSync(join(enforcementApiRoot, rel), "utf8");
      expect(src).not.toMatch(/\bupsertBaseline\b/);
      expect(src).not.toMatch(/\bappendEnforcementEvent\b/);
    });
  }
});
