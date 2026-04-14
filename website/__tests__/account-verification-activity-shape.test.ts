import { describe, expect, it } from "vitest";
import { buildLicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";
import { shapeAccountPageActivityRows } from "@/lib/funnelObservabilityQueries";

describe("shapeAccountPageActivityRows", () => {
  const valid = (overrides: Partial<{ createdAt: Date }> = {}) =>
    ({
      createdAt: overrides.createdAt ?? new Date("2026-04-01T00:00:00.000Z"),
      metadata: buildLicensedVerifyOutcomeMetadata({
        terminal_status: "complete",
        workload_class: "bundled_examples",
        subcommand: "batch_verify",
      }),
    }) as const;

  it("skips invalid metadata and preserves descending input order up to 10 rows", () => {
    const d0 = new Date("2026-04-03T00:00:00.000Z");
    const d1 = new Date("2026-04-02T00:00:00.000Z");
    const d2 = new Date("2026-04-01T00:00:00.000Z");
    const raw = [
      { createdAt: d0, metadata: { not: "valid" } },
      valid({ createdAt: d0 }),
      valid({ createdAt: d1 }),
      valid({ createdAt: d2 }),
    ];
    const shaped = shapeAccountPageActivityRows(raw);
    expect(shaped).toHaveLength(3);
    expect(shaped[0]!.createdAtIso).toBe(d0.toISOString());
    expect(shaped[1]!.createdAtIso).toBe(d1.toISOString());
    expect(shaped[2]!.createdAtIso).toBe(d2.toISOString());
    expect(shaped[0]!.terminalStatus).toBe("complete");
  });

  it("stops at 10 valid rows", () => {
    const base = new Date("2026-04-10T12:00:00.000Z");
    const raw = Array.from({ length: 15 }, (_, i) =>
      valid({
        createdAt: new Date(base.getTime() - i * 60_000),
      }),
    );
    expect(shapeAccountPageActivityRows(raw)).toHaveLength(10);
  });
});
