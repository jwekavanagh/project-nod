/** @vitest-environment jsdom */

import { DiscoverySurfacePage } from "@/components/discovery/DiscoverySurfacePage";
import * as hubMeta from "@/app/guides/page";
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

describe("indexed examples", () => {
  it("Learn hub metadata stays indexable", () => {
    expect(hubMeta.metadata.robots).toEqual({ index: true, follow: true });
  });

  it("wf-complete surface shows verification embed", () => {
    const surface = readSurfaceFile("examples", "wf-complete");
    const { container } = render(<DiscoverySurfacePage surface={surface} /> as ReactElement);
    expect(container.textContent).toContain("Bundled wf_complete demo");
    expect(container.querySelector('[data-testid="verification-report-embed"]')).toBeTruthy();
  });

  it("wf-missing surface shows ROW_ABSENT in view", () => {
    const surface = readSurfaceFile("examples", "wf-missing");
    const { container } = render(<DiscoverySurfacePage surface={surface} /> as ReactElement);
    expect(container.textContent).toContain("Bundled wf_missing demo");
    expect(container.textContent).toContain("ROW_ABSENT");
    expect(container.querySelector('[data-testid="verification-report-embed"]')).toBeTruthy();
  });

  it("langgraph-checkpoint-trust surface shows LCT story tabs and embed", () => {
    const surface = readSurfaceFile("examples", "langgraph-checkpoint-trust");
    const { container } = render(<DiscoverySurfacePage surface={surface} /> as ReactElement);
    expect(container.textContent).toContain("LangGraph checkpoint trust");
    expect(container.querySelector('[data-testid="langgraph-lct-stories"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="verification-report-embed"]')).toBeTruthy();
  });
});
