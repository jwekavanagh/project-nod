import { describe, expect, it } from "vitest";
import { flatKeyToJsonPointer } from "./flatKeyToJsonPointer.js";

describe("flatKeyToJsonPointer", () => {
  it("maps nested flatten keys", () => {
    expect(flatKeyToJsonPointer("contacts.idid")).toEqual({ ok: true, pointer: "/contacts/idid" });
  });

  it("escapes ~ and / in segments", () => {
    expect(flatKeyToJsonPointer("weird~0x")).toEqual({ ok: true, pointer: "/weird~00x" });
  });

  it("rejects empty and bad syntax", () => {
    expect(flatKeyToJsonPointer("")).toEqual({ ok: false, code: "EMPTY_KEY" });
    expect(flatKeyToJsonPointer(".a")).toEqual({ ok: false, code: "INVALID_SYNTAX" });
    expect(flatKeyToJsonPointer("a[b]")).toEqual({ ok: false, code: "INVALID_ARRAY_INDEX" });
  });

  it("supports array indices", () => {
    expect(flatKeyToJsonPointer("items[0].id")).toEqual({ ok: true, pointer: "/items/0/id" });
  });
});
