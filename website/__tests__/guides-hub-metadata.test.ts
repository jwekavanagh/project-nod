import { describe, expect, it } from "vitest";
import { metadata } from "@/app/guides/page";
import { productCopy } from "@/content/productCopy";

describe("guides hub (Learn) metadata", () => {
  it("is indexable with Learn title and description without accidental noindex wording", () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe("Learn");
    expect(String(metadata.openGraph?.title)).toBe("Learn — AgentSkeptic");
    const desc = metadata.description;
    expect(desc).toBe(productCopy.learnHubIndexDescription);
    expect(String(desc).toLowerCase()).not.toContain("noindex");
  });
});
