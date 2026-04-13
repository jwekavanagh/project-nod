import { describe, expect, it } from "vitest";
import { extractClientIpKey, formatMagicLinkWindowUtc, utcHourStart } from "@/lib/magicLinkSendGate";

describe("magicLinkSendGate helpers", () => {
  it("utcHourStart truncates to UTC hour", () => {
    const d = new Date("2026-04-12T14:35:42.123Z");
    const h = utcHourStart(d);
    expect(h.toISOString()).toBe("2026-04-12T14:00:00.000Z");
  });

  it("formatMagicLinkWindowUtc matches deny-log regex shape", () => {
    const s = formatMagicLinkWindowUtc(utcHourStart(new Date("2026-04-12T14:35:00Z")));
    expect(s).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/,
    );
    expect(s).toBe("2026-04-12T14:00:00.000Z");
  });

  it("extractClientIpKey follows header precedence", () => {
    expect(
      extractClientIpKey(
        new Request("https://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }),
      ),
    ).toBe("203.0.113.9");
    expect(
      extractClientIpKey(
        new Request("https://x", {
          headers: { "cf-connecting-ip": "198.51.100.1" },
        }),
      ),
    ).toBe("198.51.100.1");
    expect(
      extractClientIpKey(new Request("https://x", { headers: { "x-real-ip": " 192.0.2.1 " } })),
    ).toBe("192.0.2.1");
    expect(extractClientIpKey(new Request("https://x"))).toBe("unknown");
  });
});
