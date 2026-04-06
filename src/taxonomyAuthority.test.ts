import { describe, expect, it } from "vitest";
import {
  ACTION_INPUT_REASON_CODES,
  RECONCILER_STEP_REASON_CODES,
} from "./executionPathFindings.js";
import { REASON_CODE_TO_ORIGIN } from "./failureOriginCatalog.js";
import { REGISTRY_RESOLVER_CODE, SQL_VERIFICATION_OUTCOME_CODE, UNKNOWN_TOOL } from "./wireReasonCodes.js";

function sortedStrings(s: Iterable<string>): string[] {
  return [...s].sort((a, b) => a.localeCompare(b));
}

describe("taxonomyAuthority", () => {
  it("REGISTRY_RESOLVER_CODE values are keys of REASON_CODE_TO_ORIGIN", () => {
    for (const c of Object.values(REGISTRY_RESOLVER_CODE)) {
      expect(c in REASON_CODE_TO_ORIGIN, c).toBe(true);
    }
  });

  it("SQL_VERIFICATION_OUTCOME_CODE values are keys of REASON_CODE_TO_ORIGIN", () => {
    for (const c of Object.values(SQL_VERIFICATION_OUTCOME_CODE)) {
      expect(c in REASON_CODE_TO_ORIGIN, c).toBe(true);
    }
  });

  it("ACTION_INPUT_REASON_CODES equals UNKNOWN_TOOL plus all REGISTRY_RESOLVER_CODE values", () => {
    const expected = new Set([UNKNOWN_TOOL, ...Object.values(REGISTRY_RESOLVER_CODE)]);
    expect(sortedStrings(ACTION_INPUT_REASON_CODES)).toEqual(sortedStrings(expected));
  });

  it("RECONCILER_STEP_REASON_CODES equals all SQL_VERIFICATION_OUTCOME_CODE values", () => {
    expect(sortedStrings(RECONCILER_STEP_REASON_CODES)).toEqual(
      sortedStrings(Object.values(SQL_VERIFICATION_OUTCOME_CODE)),
    );
  });
});
