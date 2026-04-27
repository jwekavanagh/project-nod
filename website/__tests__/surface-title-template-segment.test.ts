import { describe, expect, it } from "vitest";
import {
  brandedMarketingTitle,
  surfaceTitleSegmentForTemplate,
} from "@/lib/marketingSocialMetadata";

describe("surfaceTitleSegmentForTemplate / brandedMarketingTitle", () => {
  it("strips a single trailing brand suffix for root title.template", () => {
    expect(surfaceTitleSegmentForTemplate("Verify LangGraph workflows against your database — AgentSkeptic")).toBe(
      "Verify LangGraph workflows against your database",
    );
  });

  it("brandedMarketingTitle is idempotent when the suffix is already present", () => {
    expect(brandedMarketingTitle("Foo — AgentSkeptic")).toBe("Foo — AgentSkeptic");
  });

  it("brandedMarketingTitle adds suffix when absent", () => {
    expect(brandedMarketingTitle("Learn")).toBe("Learn — AgentSkeptic");
  });
});
