import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { homePageTitleFromMarketing } from "@/lib/marketingSocialMetadata";

describe("app/not-found", () => {
  it("includes recovery links, noindex metadata, and signposts key hubs", () => {
    const src = readFileSync(join(process.cwd(), "src", "app", "not-found.tsx"), "utf8");
    expect(src).toContain('href="/"');
    expect(src).toContain('href="/guides"');
    expect(src).toContain('href="/integrate"');
    expect(src).toContain('href="/contact"');
    expect(src).toContain("robots: { index: false, follow: false }");
  });
});

describe("home page title helper", () => {
  it("strips a trailing period from the hero line for the public title", () => {
    expect(homePageTitleFromMarketing("Trust reality, not traces.")).toBe(
      "Trust reality, not traces — AgentSkeptic",
    );
  });
});
