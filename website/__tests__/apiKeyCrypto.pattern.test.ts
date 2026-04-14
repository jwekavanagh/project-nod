import { describe, expect, it } from "vitest";
import { API_KEY_ISSUED_PATTERN, randomHexWithWfSkLivePrefix } from "@/lib/apiKeyCrypto";

describe("API_KEY_ISSUED_PATTERN", () => {
  it("matches output of randomHexWithWfSkLivePrefix", () => {
    const k = randomHexWithWfSkLivePrefix();
    expect(API_KEY_ISSUED_PATTERN.test(k)).toBe(true);
  });
});
