/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SecurityPage from "@/app/security/page";
import { getSecurityQuickFacts } from "@/lib/commercialNarrative";

afterEach(() => {
  cleanup();
});

describe("Security quick facts", () => {
  it("third bullet is the quick vs contract contract line", () => {
    const qf = getSecurityQuickFacts();
    render(<SecurityPage />);
    const section = screen.getByTestId("security-quick-facts");
    const list = section.querySelector("ul");
    expect(list).toBeTruthy();
    const items = within(list!).getAllByRole("listitem");
    expect(items[2]).toHaveTextContent(qf.bullets[2]!);
  });

  it("fourth bullet points to buyer trust guide and GitHub verification SSOT", () => {
    render(<SecurityPage />);
    const section = screen.getByTestId("security-quick-facts");
    const list = section.querySelector("ul");
    expect(list).toBeTruthy();
    const items = within(list!).getAllByRole("listitem");
    expect(items[3].textContent).toContain("trust buyer guide");
    expect(items[3].textContent).toContain("verification-product.md");
  });
});
