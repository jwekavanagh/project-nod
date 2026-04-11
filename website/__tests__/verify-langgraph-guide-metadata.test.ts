import { describe, expect, it } from "vitest";
import { metadata } from "@/app/guides/verify-langgraph-workflows/page";

describe("LangGraph guide page metadata", () => {
  it("is indexable", () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });
});
