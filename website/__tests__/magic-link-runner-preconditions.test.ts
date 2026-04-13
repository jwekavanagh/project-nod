import { beforeEach, describe, expect, it, vi } from "vitest";

const { reserveMock, sendMock } = vi.hoisted(() => ({
  reserveMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@/lib/magicLinkSendGate", () => ({
  reserveMagicLinkSendSlot: reserveMock,
}));

vi.mock("@/lib/sendMagicLink", () => ({
  sendMagicLink: sendMock,
}));

import { runMagicLinkVerificationRequest } from "@/lib/runMagicLinkVerificationRequest";

describe("runMagicLinkVerificationRequest preconditions", () => {
  beforeEach(() => {
    reserveMock.mockReset();
    sendMock.mockReset();
    reserveMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue(undefined);
  });

  it("throws when identifier is not a string and does not call gate or send", async () => {
    await expect(
      runMagicLinkVerificationRequest({
        identifier: null as unknown as string,
        url: "http://x",
      }),
    ).rejects.toThrow("Magic link verification: identifier must be a string");
    expect(reserveMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws when url is not a string and does not call gate or send", async () => {
    await expect(
      runMagicLinkVerificationRequest({
        identifier: "a@b.com",
        url: null as unknown as string,
      }),
    ).rejects.toThrow("Magic link verification: url must be a string");
    expect(reserveMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws when identifier is empty after trim and does not call gate or send", async () => {
    await expect(
      runMagicLinkVerificationRequest({ identifier: "   ", url: "http://x" }),
    ).rejects.toThrow("Magic link verification: identifier is empty");
    expect(reserveMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("calls reserve then send on valid input", async () => {
    await runMagicLinkVerificationRequest({
      identifier: " User@Example.com ",
      url: "http://localhost/callback",
    });
    expect(reserveMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith("user@example.com", "http://localhost/callback");
  });
});
