import { FUNNEL_EVENT_NAMES } from "@/lib/funnelEvents";
import {
  assertFunnelEventTierPartition,
  CORE_TIER_FUNNEL_EVENTS,
  TELEMETRY_TIER_FUNNEL_EVENTS,
} from "@/lib/funnelEventTier";
import { describe, expect, it } from "vitest";

describe("funnelEventTier", () => {
  it("partitions FUNNEL_EVENT_NAMES", () => {
    expect(() => assertFunnelEventTierPartition()).not.toThrow();
    const all = new Set([...TELEMETRY_TIER_FUNNEL_EVENTS, ...CORE_TIER_FUNNEL_EVENTS]);
    expect(all.size).toBe(FUNNEL_EVENT_NAMES.length);
  });
});
