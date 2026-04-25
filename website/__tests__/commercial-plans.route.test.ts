import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/commercial/plans/route";

describe("GET /api/v1/commercial/plans", () => {
  it("returns schemaVersion and public plan fields without stripe env keys", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/commercial/plans"));
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      schemaVersion: number;
      plans: Record<
        string,
        {
          displayPrice: string;
          marketingHeadline: string;
          includedMonthly: number | null;
          allowOverage?: boolean;
          overageMicrousdPerVerification?: number | null;
        }
      >;
    };
    expect(j.schemaVersion).toBe(2);
    expect(j.plans.starter?.marketingHeadline).toBe("Starter");
    expect(j.plans.starter?.includedMonthly).toBe(1000);
    expect(j.plans.starter?.allowOverage).toBe(false);
    expect(j.plans.individual?.displayPrice).toBe("$19/month");
    expect(j.plans.team?.displayPrice).toBe("$79/month");
    expect(j.plans.individual?.allowOverage).toBe(true);
    expect(j.plans.individual?.overageMicrousdPerVerification).toBe(15000);
    const raw = JSON.stringify(j);
    expect(raw).not.toMatch(/stripePriceEnvKey|STRIPE_PRICE/i);
  });
});
