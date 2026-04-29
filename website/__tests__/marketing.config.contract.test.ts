import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";

const require = createRequire(import.meta.url);

describe("marketing config", () => {
  it("validates with discovery-acquisition.lib (invariants)", () => {
    const root = getRepoRoot();
    require(join(root, "scripts", "discovery-acquisition.lib.cjs")).validateDiscoveryAcquisition(root);
  });

  it("marketing.json must not resurrect removed r2 (buyer frameworks live in buyer-truth.v1.json)", () => {
    const root = getRepoRoot();
    const raw = JSON.parse(readFileSync(join(root, "config", "marketing.json"), "utf8")) as Record<string, unknown>;
    expect("r2" in raw).toBe(false);
    const ig = raw.integratePage as Record<string, unknown>;
    expect(ig).toBeTruthy();
    expect("requirements" in ig).toBe(false);
  });
});
