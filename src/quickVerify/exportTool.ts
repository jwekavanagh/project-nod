import type { ResolvedRelationalCheck, ToolRegistryEntry, VerificationRequest } from "../types.js";
import { compareUtf16Id } from "../resolveExpectation.js";

/**
 * Build Advanced-mode registry entry for a row unit (sql_row + pointers for dynamic fields).
 */
export function exportSqlRowTool(toolId: string, req: VerificationRequest): ToolRegistryEntry {
  const identityEq = req.identityEq.map((p) => ({
    column: { const: p.column },
    value: { const: p.value },
  }));
  return {
    toolId,
    effectDescriptionTemplate: `Quick inferred row: ${req.table}`,
    verification: {
      kind: "sql_row",
      table: { const: req.table },
      identityEq,
      requiredFields: { pointer: "/__qvFields" },
    },
  } as ToolRegistryEntry;
}

/** Row export with JSON Pointer identity values (Quick param-pointer contract path). */
export function exportSqlRowParamPointerTool(
  toolId: string,
  table: string,
  identityPointers: Array<{ column: string; valuePointer: string }>,
): ToolRegistryEntry {
  const identityEq = [...identityPointers]
    .sort((a, b) => compareUtf16Id(a.column, b.column))
    .map((p) => ({
      column: { const: p.column },
      value: { pointer: p.valuePointer },
    }));
  return {
    toolId,
    effectDescriptionTemplate: `Quick inferred row: ${table}`,
    verification: {
      kind: "sql_row",
      table: { const: table },
      identityEq,
      requiredFields: { pointer: "/__qvFields" },
    },
  } as ToolRegistryEntry;
}

/**
 * Build Advanced `sql_relational` registry entry for one inferred `related_exists` check (all const; batch replay with `params: {}`).
 */
export function exportSqlRelationalRelatedExistsTool(
  toolId: string,
  rel: Extract<ResolvedRelationalCheck, { checkKind: "related_exists" }>,
): ToolRegistryEntry {
  const sortedEq = [...rel.matchEq].sort((a, b) => compareUtf16Id(a.column, b.column));
  const matchEq = sortedEq.map((m) => ({
    column: { const: m.column },
    value: { const: m.value },
  }));
  return {
    toolId,
    effectDescriptionTemplate: `Quick inferred related_exists: ${rel.id}`,
    verification: {
      kind: "sql_relational",
      checks: [
        {
          checkKind: "related_exists",
          id: rel.id,
          childTable: { const: rel.childTable },
          matchEq,
        },
      ],
    },
  } as ToolRegistryEntry;
}
