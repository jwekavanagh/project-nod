/** @vitest-environment jsdom */

import GuidesHubPage from "@/app/guides/page";
import { learnHub } from "@/content/productCopy";
import { DiscoverySurfacePage } from "@/components/discovery/DiscoverySurfacePage";
import * as hubMeta from "@/app/guides/page";
import { listAllSurfaces, readSurfaceFile } from "@/lib/surfaceMarkdown";
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

function assertGuideShell(surface: ReturnType<typeof readSurfaceFile>) {
  const { container } = render(<DiscoverySurfacePage surface={surface} /> as ReactElement);
  const shell = container.querySelector('[data-testid="indexed-guide-shell"]');
  expect(shell).toBeTruthy();
  const text = (shell as HTMLElement).textContent ?? "";
  expect(text.toUpperCase()).toContain("ROW_ABSENT");
  expect((shell as HTMLElement).querySelector('a[href="/integrate"]')).toBeTruthy();
}

describe("indexed guides", () => {
  it("hub is indexable, lists curated hub targets, and primary CTAs", () => {
    expect(hubMeta.metadata.robots).toEqual({ index: true, follow: true });
    const { container } = render(<GuidesHubPage />);
    const curated = [...learnHub.popular, ...learnHub.debug] as readonly { href: string }[];
    for (const item of curated) {
      expect(container.querySelector(`a[href="${item.href}"]`)).toBeTruthy();
    }
    expect(container.querySelector('a[href="/integrate"]')).toBeTruthy();
    expect(container.querySelector('a[href="/verify"]')).toBeTruthy();
  });

  it("each guide surfaceKind guide meets shell contract", () => {
    const guides = listAllSurfaces().filter((s) => s.surfaceKind === "guide" && s.segment === "guides");
    for (const s of guides) {
      assertGuideShell(readSurfaceFile("guides", s.slug));
    }
  });
});
