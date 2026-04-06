import { describe, expect, it } from "vitest";
import {
  EVENT_SEQUENCE_MESSAGES,
  RUN_LEVEL_MESSAGES,
} from "./failureCatalog.js";
import {
  EVENT_SEQUENCE_CODE_TO_ORIGIN,
  RUN_LEVEL_CODE_TO_ORIGIN,
} from "./failureOriginCatalog.js";

describe("failureOriginCatalog exhaustiveness", () => {
  it("every run-level message key maps", () => {
    for (const k of Object.keys(RUN_LEVEL_MESSAGES) as (keyof typeof RUN_LEVEL_MESSAGES)[]) {
      expect(RUN_LEVEL_CODE_TO_ORIGIN[k], k).toBeDefined();
    }
  });

  it("every event-sequence message key maps", () => {
    for (const k of Object.keys(EVENT_SEQUENCE_MESSAGES) as (keyof typeof EVENT_SEQUENCE_MESSAGES)[]) {
      expect(EVENT_SEQUENCE_CODE_TO_ORIGIN[k], k).toBeDefined();
    }
    expect(EVENT_SEQUENCE_CODE_TO_ORIGIN["TIMESTAMP_NOT_MONOTONIC_WITH_SEQ_SORT_ORDER"]).toBeDefined();
  });
});
