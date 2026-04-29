import { describe, expect, it } from "vitest";
import { resolveAttributionSurface } from "@/lib/attributionRoutePolicy";

describe("resolveAttributionSurface", () => {
  it("returns acquisition for homepage and audited marketing paths", () => {
    expect(resolveAttributionSurface("/")).toBe("acquisition");
    expect(resolveAttributionSurface("/database-truth-vs-traces")).toBe("acquisition");
    expect(resolveAttributionSurface("/pricing")).toBe("acquisition");
    expect(resolveAttributionSurface("/guides")).toBe("acquisition");
    expect(resolveAttributionSurface("/guides/foo")).toBe("acquisition");
    expect(resolveAttributionSurface("/claim")).toBe("acquisition");
    expect(resolveAttributionSurface("/verify")).toBe("acquisition");
    expect(resolveAttributionSurface("/verify/link")).toBe("acquisition");
    expect(resolveAttributionSurface("/examples/wf-complete")).toBe("acquisition");
  });

  it("returns integrate only for exact /integrate", () => {
    expect(resolveAttributionSurface("/integrate")).toBe("integrate");
    expect(resolveAttributionSurface("/integrate/")).toBe("integrate");
  });

  it("returns null for unlisted marketing paths (fail closed)", () => {
    expect(resolveAttributionSurface("/unknown-marketing")).toBeNull();
    expect(resolveAttributionSurface("/api/foo")).toBeNull();
  });

  it("returns null for account, auth, and public report routes", () => {
    expect(resolveAttributionSurface("/account")).toBeNull();
    expect(resolveAttributionSurface("/account/billing")).toBeNull();
    expect(resolveAttributionSurface("/auth/signin")).toBeNull();
    expect(resolveAttributionSurface("/r/abc")).toBeNull();
    expect(resolveAttributionSurface("/r")).toBeNull();
  });

  it("does not treat /integrate as acquisition", () => {
    expect(resolveAttributionSurface("/integrate")).not.toBe("acquisition");
  });
});
