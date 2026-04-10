import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveCommercialEntitlement,
  type EntitlementDenyCode,
} from "@/lib/commercialEntitlement";
import type { PlanId } from "@/lib/plans";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const matrixPath = path.resolve(__dirname, "../../config/commercial-entitlement-matrix.v1.json");

type MatrixRow = {
  plan: PlanId;
  subscriptionStatus: "none" | "active" | "inactive";
  intent: "verify" | "enforce";
  emergencyAllow: boolean;
  expectProceedToQuota: boolean;
  expectedDenyCode: EntitlementDenyCode | null;
};

describe("commercial entitlement matrix", () => {
  const data = JSON.parse(readFileSync(matrixPath, "utf8")) as {
    schemaVersion: number;
    rows: MatrixRow[];
  };

  it("has 60 rows", () => {
    expect(data.schemaVersion).toBe(1);
    expect(data.rows).toHaveLength(60);
  });

  it.each(data.rows)(
    "$plan $subscriptionStatus $intent emergency=$emergencyAllow",
    (row) => {
      const got = resolveCommercialEntitlement({
        planId: row.plan,
        subscriptionStatus: row.subscriptionStatus,
        intent: row.intent,
        emergencyAllow: row.emergencyAllow,
      });
      if (row.expectProceedToQuota) {
        expect(got).toEqual({ proceedToQuota: true });
      } else {
        expect(got).toEqual({
          proceedToQuota: false,
          denyCode: row.expectedDenyCode,
        });
      }
    },
  );
});
