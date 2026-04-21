/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SecurityPage from "@/app/security/page";
import { SECURITY_QUICK_VS_CONTRACT_BULLET } from "@/content/marketingContracts";

describe("Security quick facts", () => {
  it("third bullet is the quick vs contract contract line", () => {
    render(<SecurityPage />);
    const list = screen.getByTestId("security-quick-facts").querySelector("ul");
    expect(list).toBeTruthy();
    const items = within(list!).getAllByRole("listitem");
    expect(items[2]).toHaveTextContent(SECURITY_QUICK_VS_CONTRACT_BULLET);
  });
});
