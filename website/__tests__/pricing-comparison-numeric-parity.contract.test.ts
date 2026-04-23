import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRICING_FEATURE_COMPARISON } from "@/content/marketingContracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("pricing comparison vs commercial-plans.json caps", () => {
  it("Individual, Team, and Business included-monthly cells match config", () => {
    const root = path.resolve(__dirname, "..", "..");
    const raw = JSON.parse(
      readFileSync(path.join(root, "config", "commercial-plans.json"), "utf8"),
    ) as { plans: Record<string, { includedMonthly: number | null }> };
    const quotaRow = PRICING_FEATURE_COMPARISON.rows.find((r) =>
      r.feature.startsWith("Monthly paid verifications"),
    );
    expect(quotaRow).toBeTruthy();
    const fmt = (n: number | null) =>
      n === null || n === undefined ? "" : new Intl.NumberFormat("en-US").format(n);
    expect(quotaRow!.individual).toBe(fmt(raw.plans.individual.includedMonthly));
    expect(quotaRow!.team).toBe(fmt(raw.plans.team.includedMonthly));
    expect(quotaRow!.business).toBe(fmt(raw.plans.business.includedMonthly));
  });
});
