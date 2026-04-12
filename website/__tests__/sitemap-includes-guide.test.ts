import sitemap from "@/app/sitemap";
import { describe, expect, it } from "vitest";

describe("sitemap", () => {
  it("includes /guides/verify-langgraph-workflows and /security", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/guides/verify-langgraph-workflows"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/security"))).toBe(true);
  });
});
