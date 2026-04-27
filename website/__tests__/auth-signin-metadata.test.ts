import { metadata } from "@/app/auth/signin/page";
import { describe, expect, it } from "vitest";

describe("auth sign-in metadata", () => {
  it("is noindex and describes sign-in", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("Sign in");
    expect(String(metadata.description).toLowerCase()).toContain("sign in");
  });
});
