import { describe, expect, it } from "vitest";
import { metadata } from "@/app/guides/page";
import { productCopy } from "@/content/productCopy";

describe("guides hub (Learn) metadata", () => {
  it("is indexable with Learn hub title and description without accidental noindex wording", () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe("Learn how to verify agent outcomes");
    expect(String(metadata.openGraph?.title)).toBe("Learn how to verify agent outcomes — AgentSkeptic");
    const desc = metadata.description;
    expect(desc).toBe(productCopy.learnHubIndexDescription);
    expect(String(desc).toLowerCase()).not.toContain("noindex");
  });
});
