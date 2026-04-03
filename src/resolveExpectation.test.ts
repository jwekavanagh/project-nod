import { describe, expect, it } from "vitest";
import { resolveVerificationRequest } from "./resolveExpectation.js";
import type { ToolRegistryEntry } from "./types.js";

const baseEntry: ToolRegistryEntry = {
  toolId: "t",
  effectDescriptionTemplate: "x",
  verification: {
    kind: "sql_row",
    table: { const: "contacts" },
    key: { column: { const: "id" }, value: { const: "1" } },
    requiredFields: { pointer: "/fields" },
  },
};

describe("resolveVerificationRequest requiredFields scalars", () => {
  it("resolves null and number in fields object", () => {
    const r = resolveVerificationRequest(baseEntry, {
      fields: { name: null, qty: 7 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.requiredFields).toEqual({ name: null, qty: 7 });
    }
  });

  it("resolves boolean and string", () => {
    const r = resolveVerificationRequest(baseEntry, {
      fields: { active: true, label: "hi" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.requiredFields).toEqual({ active: true, label: "hi" });
    }
  });

  it("rejects nested object field value", () => {
    const r = resolveVerificationRequest(baseEntry, {
      fields: { bad: { x: 1 } },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects undefined field value", () => {
    const r = resolveVerificationRequest(baseEntry, {
      fields: { u: undefined },
    });
    expect(r.ok).toBe(false);
  });
});
