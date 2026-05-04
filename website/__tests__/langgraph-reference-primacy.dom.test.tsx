/** @vitest-environment jsdom */

import IntegratePage from "@/app/integrate/page";
import { DiscoverySurfacePage } from "@/components/discovery/DiscoverySurfacePage";
import { langgraphReferenceReadmeUrl } from "@/lib/langgraphReferenceReadmeUrl";
import { readSurfaceFile } from "@/lib/surfaceMarkdown";
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
  it("/integrate: no LangGraph primary CTA; truth-check commands present", () => {
    const { container } = render(<IntegratePage /> as ReactElement);
    expect(container.querySelector('[data-testid="integrator-primary-cta"]')).toBeNull();
    expect(container.querySelector('[data-testid="integrate-truth-check-commands"]')).toBeTruthy();
  });

  it("LangGraph guide: first https link in prose matches canonical README blob URL", () => {
    const surface = readSurfaceFile("guides", "verify-langgraph-workflows");
    const { container } = render(<DiscoverySurfacePage surface={surface} /> as ReactElement);
    const prose = container.querySelector(".integrate-prose");
    expect(prose).toBeTruthy();
    const https = (prose as HTMLElement).querySelectorAll('a[href^="https://"]');
    expect(https.length).toBeGreaterThan(0);
    expect((https[0] as HTMLAnchorElement).getAttribute("href")).toBe(langgraphReferenceReadmeUrl);
  });
});
