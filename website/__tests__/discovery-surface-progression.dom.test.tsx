/** @vitest-environment jsdom */

import { DiscoverySurfacePage } from "@/components/discovery/DiscoverySurfacePage";
import { SurfaceProgression } from "@/components/discovery/SurfaceProgression";
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

describe("SurfaceProgression", () => {
  it("marks exactly one primary CTA and always links /security", () => {
    const { container } = render(<SurfaceProgression primaryCta="demo" />);
    const prim = container.querySelectorAll('[data-cta-priority="primary"]');
    expect(prim.length).toBe(1);
    expect((prim[0] as HTMLAnchorElement).getAttribute("href")).toBe("/?demo=wf_missing#try-it");
    expect(container.querySelector('a[href="/security"]')).toBeTruthy();
    expect(container.querySelector('a[href="/integrate"]')).toBeTruthy();
    expect(container.querySelector('a[href="/pricing"]')).toBeTruthy();
  });
});

describe("DiscoverySurfacePage", () => {
  it("uses get-started as the dominant CTA for comparison surfaces", () => {
    const surface = readSurfaceFile("compare", "observability-vs-preaction-gate");
    const { container } = render(<DiscoverySurfacePage surface={surface} /> as ReactElement);
    const prim = container.querySelectorAll('[data-cta-priority="primary"]');
    expect(prim.length).toBe(1);
    expect((prim[0] as HTMLAnchorElement).getAttribute("href")).toBe("/integrate");
  });
});
