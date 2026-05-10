import { describe, expect, it } from "vitest";
import {
  buildWitnessCoverageFromSteps,
  CANONICAL_WITNESS_KINDS,
  witnessKindsFromVerificationRequest,
  type CanonicalWitnessRollupKind,
  type WitnessCoverageRollupJson,
} from "./witnessCoverageRollup.js";
import type { StepOutcome } from "./types.js";

function baseStep(
  partial: Omit<Partial<StepOutcome>, "seq" | "toolId"> & Pick<StepOutcome, "seq" | "toolId"> &
    Pick<Partial<StepOutcome>, "verificationRequest" | "status"> &
    Partial<StepOutcome>,
): StepOutcome {
  return {
    seq: partial.seq,
    toolId: partial.toolId,
    releaseCritical: partial.releaseCritical ?? false,
    intendedEffect: partial.intendedEffect ?? { narrative: "n" },
    observedExecution: partial.observedExecution ?? { paramsCanonical: "{}" },
    verificationRequest: partial.verificationRequest ?? null,
    status: partial.status ?? "verified",
    reasons: partial.reasons ?? [],
    evidenceSummary: partial.evidenceSummary ?? {},
    repeatObservationCount: partial.repeatObservationCount ?? 1,
    evaluatedObservationOrdinal: partial.evaluatedObservationOrdinal ?? 1,
    ...(("failureDiagnostic" in partial ? { failureDiagnostic: partial.failureDiagnostic } : {}) as object),
    ...(("langgraphCheckpointKey" in partial ? { langgraphCheckpointKey: partial.langgraphCheckpointKey } : {}) as object),
  } as StepOutcome;
}

describe("witnessKindsFromVerificationRequest", () => {
  it("maps sql families to sql", () => {
    expect(witnessKindsFromVerificationRequest({ kind: "sql_row", table: "t", identityEq: [], requiredFields: {} })).toEqual([
      "sql",
    ]);
    expect(witnessKindsFromVerificationRequest({ kind: "sql_effects", effects: [] })).toEqual(["sql"]);
  });

  it("maps non-SQL witnesses distinctly", () => {
    expect(
      witnessKindsFromVerificationRequest({
        kind: "http_witness",
        method: "GET",
        url: "https://x",
        expectedStatus: 200,
      }),
    ).toEqual(["http_witness"]);
    expect(
      witnessKindsFromVerificationRequest({
        kind: "vector_document",
        provider: "pinecone",
        documentId: "d",
        indexName: "i",
      }),
    ).toEqual(["vector_document"]);
  });

  it("null yields empty kinds", () => {
    expect(witnessKindsFromVerificationRequest(null)).toEqual([]);
  });
});

describe("buildWitnessCoverageFromSteps", () => {
  it("empty steps → thin_or_unknown", () => {
    const r = buildWitnessCoverageFromSteps([]);
    expect(r).toMatchObject({
      schemaVersion: 1,
      exercisedKinds: [],
      fullySatisfiedKinds: [],
      notFullySatisfiedKinds: [],
      supportLabel: "thin_or_unknown",
    });
    expect(r.summaryLine).toBeDefined();
    expect(String(r.summaryLine)).toContain("No verification modalities");
  });

  it("SQL verified only → sql_only_contract", () => {
    const r = buildWitnessCoverageFromSteps([
      baseStep({
        seq: 0,
        toolId: "x",
        status: "verified",
        verificationRequest: {
          kind: "sql_row",
          table: "contacts",
          identityEq: [{ column: "id", value: "1" }],
          requiredFields: { name: "a" },
        },
      }),
    ]);
    expect(r.exercisedKinds).toEqual(["sql"]);
    expect(r.fullySatisfiedKinds).toEqual(["sql"]);
    expect(r.notFullySatisfiedKinds).toEqual([]);
    expect(r.supportLabel).toBe("sql_only_contract");
  });

  it("partially_verified SQL → modality not fully satisfied + coverage label", () => {
    const r = buildWitnessCoverageFromSteps([
      baseStep({
        seq: 0,
        toolId: "x",
        status: "partially_verified",
        verificationRequest: { kind: "sql_effects", effects: [] },
        reasons: [{ code: "MULTI_EFFECT_PARTIAL", message: "m" }],
      }),
    ]);
    expect(r.exercisedKinds).toEqual(["sql"]);
    expect(r.fullySatisfiedKinds).toEqual([]);
    expect(r.notFullySatisfiedKinds).toEqual(["sql"]);
    expect(r.supportLabel).toBe("coverage_incomplete_or_failed");
  });

  it("two modalities both verified → meaningful_multi_witness", () => {
    const rows: StepOutcome[] = [
      baseStep({
        seq: 0,
        toolId: "a",
        status: "verified",
        verificationRequest: {
          kind: "sql_row",
          table: "t",
          identityEq: [],
          requiredFields: {},
        },
      }),
      baseStep({
        seq: 1,
        toolId: "b",
        status: "verified",
        verificationRequest: {
          kind: "http_witness",
          method: "GET",
          url: "https://api",
          expectedStatus: 200,
        },
      }),
    ];
    const r = buildWitnessCoverageFromSteps(rows);
    expect(r.exercisedKinds.sort()).toEqual(["http_witness", "sql"]);
    expect(r.fullySatisfiedKinds.sort()).toEqual(["http_witness", "sql"]);
    expect(r.notFullySatisfiedKinds).toEqual([]);
    expect(r.supportLabel).toBe("meaningful_multi_witness");
  });

  it("HTTP only verified → single_non_sql_contract", () => {
    const r = buildWitnessCoverageFromSteps([
      baseStep({
        seq: 0,
        toolId: "api",
        status: "verified",
        verificationRequest: {
          kind: "http_witness",
          method: "GET",
          url: "https://h",
          expectedStatus: 200,
        },
      }),
    ]);
    expect(r.supportLabel).toBe("single_non_sql_contract");
    expect(r.fullySatisfiedKinds).toEqual(["http_witness"]);
  });

  it("worst rank dominates across steps for same modality", () => {
    const r = buildWitnessCoverageFromSteps([
      baseStep({
        seq: 0,
        toolId: "good",
        status: "verified",
        verificationRequest: {
          kind: "sql_row",
          table: "t",
          identityEq: [],
          requiredFields: {},
        },
      }),
      baseStep({
        seq: 1,
        toolId: "bad",
        status: "missing",
        verificationRequest: {
          kind: "sql_row_absent",
          table: "t",
          identityEq: [],
          filterEq: [],
        },
        reasons: [{ code: "ROW_ABSENT", message: "" }],
      }),
    ]);
    expect(r.notFullySatisfiedKinds).toContain("sql");
    expect(r.fullySatisfiedKinds).not.toContain("sql");
    expect(r.supportLabel).toBe("coverage_incomplete_or_failed");
  });
});

describe("CANONICAL_WITNESS_KINDS parity with composite action literals", () => {
  /** Mirror `.github/actions/agentskeptic-check/witnessKindFromCode.mjs` string constants — update both if taxonomy changes */
  const LITERAL_EXPECTED_SORTED = [
    "http_witness",
    "mongo_document",
    "object_storage",
    "sql",
    "state_witness",
    "vector_document",
  ] satisfies CanonicalWitnessRollupKind[];

  it("exported tuple matches rollup enum order used by witnessKindFromCode.mjs VALUE set", () => {
    expect([...(CANONICAL_WITNESS_KINDS as readonly string[])].sort((a, b) => a.localeCompare(b))).toEqual([
      ...LITERAL_EXPECTED_SORTED,
    ].sort((a, b) => a.localeCompare(b)));
  });
});
