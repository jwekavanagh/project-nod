import { describe, expect, it } from "vitest";
import { buildRegistryDraftPrompt } from "./buildRegistryDraftPrompt.js";

describe("buildRegistryDraftPrompt", () => {
  it("names required tool keys and forbids common model mistakes", () => {
    const p = buildRegistryDraftPrompt({ workflowId: "wf_x", tool_calls: [] }, undefined);
    expect(p).toContain("toolId");
    expect(p).toContain("effectDescriptionTemplate");
    expect(p).toContain('"kind":"sql_row"');
    expect(p).toContain("\"model\":");
    expect(p).toContain("Do NOT use \"name\" instead of toolId");
    expect(p).toContain("never use a sibling property named \"sql_row\"");
  });
});
