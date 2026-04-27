import { describe, expect, it, vi } from "vitest";

const selectMock = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    select: selectMock,
  },
}));

describe("loadReliabilitySignalsForUser", () => {
  it("returns empty fallback when query fails", async () => {
    selectMock.mockImplementationOnce(() => {
      throw new Error("db unavailable");
    });

    const { loadReliabilitySignalsForUser } = await import("@/lib/reliabilitySignals");
    const result = await loadReliabilitySignalsForUser("user_123");

    expect(result).toEqual({
      kind: "empty",
      message: "No licensed verification completions in the last 30 days.",
    });
  });
});
