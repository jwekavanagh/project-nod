/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInPage from "@/app/auth/signin/page";
import { productCopy } from "@/content/productCopy";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
});

describe("sign-in page copy", () => {
  it("shows title and magic-link helper without commercial details", async () => {
    render(
      <Suspense fallback={null}>
        <SignInPage />
      </Suspense>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: /sign in/i })).toBeTruthy();
    expect(screen.getByText(productCopy.signInPurpose.intro)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/^Details$/i)).toBeNull();
  });
});
