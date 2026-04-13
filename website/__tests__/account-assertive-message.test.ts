import { describe, expect, it } from "vitest";
import { accountAssertiveMessage } from "@/lib/accountAssertiveMessage";

describe("accountAssertiveMessage", () => {
  it("prefers portalErr over err and timeout", () => {
    expect(
      accountAssertiveMessage("portal first", "key err", "timeout"),
    ).toBe("portal first");
  });

  it("uses err when portal is empty", () => {
    expect(accountAssertiveMessage(null, "key failed", "timeout")).toBe("key failed");
  });

  it("uses timeout copy when portal and err are empty and activation timed out", () => {
    expect(accountAssertiveMessage(null, null, "timeout")).toContain("Still processing");
  });

  it("returns null when nothing applies", () => {
    expect(accountAssertiveMessage(null, null, "pending")).toBeNull();
  });
});
