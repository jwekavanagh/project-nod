/** @vitest-environment jsdom */

import IntegratePage from "@/app/integrate/page";
import LangGraphVerificationGuidePage from "@/app/guides/verify-langgraph-workflows/page";
import { langgraphReferenceReadmeUrl } from "@/lib/langgraphReferenceReadmeUrl";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

afterEach(() => {
  cleanup();
});

describe("langgraph reference integrator primacy", () => {
  it("/integrate: primary CTA precedes activation commands in DOM order", () => {
    const { container } = render(<IntegratePage /> as ReactElement);
    const primary = container.querySelector('[data-testid="integrator-primary-cta"]');
    const activation = container.querySelector('[data-testid="integrator-activation-commands"]');
    expect(primary).toBeTruthy();
    expect(activation).toBeTruthy();
    const pos = primary!.compareDocumentPosition(activation!);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("LangGraph guide: primary block first https link matches canonical README blob URL", () => {
    const { container } = render(<LangGraphVerificationGuidePage /> as ReactElement);
    const wrap = container.querySelector('[data-testid="langgraph-guide-primary-cta"]');
    expect(wrap).toBeTruthy();
    expect(container.querySelector(".mechanism-list")).toBeNull();
    const https = (wrap as HTMLElement).querySelectorAll('a[href^="https://"]');
    expect(https.length).toBeGreaterThan(0);
    expect((https[0] as HTMLAnchorElement).getAttribute("href")).toBe(langgraphReferenceReadmeUrl);
  });
});
