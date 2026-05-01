import type { DatabaseSync } from "node:sqlite";
import type { Pool as Mysql2Pool } from "mysql2/promise";
import { formatOperationalMessage } from "./failureCatalog.js";
import { compareUtf16Id } from "./resolveExpectation.js";
import type { ResolvedRelationalCheck } from "./types.js";
import { MAX_VERIFICATION_SAMPLE_ROWS } from "./reconciler.js";
import { SQL_VERIFICATION_OUTCOME_CODE } from "./wireReasonCodes.js";
import type { ReconcileOutput } from "./reconciler.js";
import { nextPlaceholderRelational, quoteIdent as quoteIdentDialect, type RelationalSqlDialect } from "./sqlDialect.js";

function qid(dialect: RelationalSqlDialect, id: string): string {
  return quoteIdentDialect(dialect, id);
}

/** Exported for tests: EXISTS SQL shape for `related_exists` (single-column match). */
export function buildRelatedExistsSql(
  dialect: RelationalSqlDialect,
  childTable: string,
  fkColumn: string,
): { text: string } {
  const { text } = buildRelationalScalarSql(dialect, {
    checkKind: "related_exists",
    id: "_",
    childTable,
    matchEq: [{ column: fkColumn, value: "_" }],
  });
  return { text };
}

export function buildRelationalScalarSql(
  dialect: RelationalSqlDialect,
  check: ResolvedRelationalCheck,
): { text: string; values: string[] } {
  if (check.checkKind === "related_exists") {
    const t = qid(dialect, check.childTable);
    const conds: string[] = [];
    const values: string[] = [];
    let pn = 1;
    for (const w of check.matchEq) {
      conds.push(`${t}.${qid(dialect, w.column)} = ${nextPlaceholderRelational(dialect, pn++)}`);
      values.push(w.value);
    }
    const text = `SELECT EXISTS (SELECT 1 FROM ${t} WHERE ${conds.join(" AND ")} LIMIT 1) AS v`;
    return { text, values };
  }

  if (check.checkKind === "anti_join") {
    const at = qid(dialect, check.anchorTable);
    const lt = qid(dialect, check.lookupTable);
    const condsOn: string[] = [];
    const values: string[] = [];
    let pn = 1;
    condsOn.push(`A.${qid(dialect, check.anchorColumn)} = L.${qid(dialect, check.lookupColumn)}`);
    for (const w of check.filterEqLookup) {
      condsOn.push(`L.${qid(dialect, w.column)} = ${nextPlaceholderRelational(dialect, pn++)}`);
      values.push(w.value);
    }
    const whereParts: string[] = [`L.${qid(dialect, check.lookupPresenceColumn)} IS NULL`];
    for (const w of check.filterEqAnchor) {
      whereParts.push(`A.${qid(dialect, w.column)} = ${nextPlaceholderRelational(dialect, pn++)}`);
      values.push(w.value);
    }
    const text = `SELECT COUNT(*) AS v FROM ${at} AS A LEFT JOIN ${lt} AS L ON ${condsOn.join(" AND ")} WHERE ${whereParts.join(" AND ")}`;
    return { text, values };
  }

  if (check.checkKind === "aggregate") {
    const tbl = qid(dialect, check.table);
    let selectPart: string;
    if (check.fn === "COUNT_STAR") {
      selectPart = `SELECT COUNT(*) AS v FROM ${tbl}`;
    } else {
      const col = check.sumColumn;
      if (!col) {
        throw new Error("SUM requires sumColumn");
      }
      selectPart = `SELECT COALESCE(SUM(${qid(dialect, col)}), 0) AS v FROM ${tbl}`;
    }
    if (check.whereEq.length === 0) {
      return { text: selectPart, values: [] };
    }
    let pn = 1;
    const conds = check.whereEq.map((w) => {
      const ph = nextPlaceholderRelational(dialect, pn++);
      return `${tbl}.${qid(dialect, w.column)} = ${ph}`;
    });
    return {
      text: `${selectPart} WHERE ${conds.join(" AND ")}`,
      values: check.whereEq.map((w) => w.value),
    };
  }

  if (check.checkKind === "join_count") {
    const lt = qid(dialect, check.leftTable);
    const rt = qid(dialect, check.rightTable);
    const base =
      `SELECT COUNT(*) AS v FROM ${lt} AS L INNER JOIN ${rt} AS R ON L.${qid(dialect, check.leftJoinColumn)} = R.${qid(dialect, check.rightJoinColumn)}`;
    if (check.whereEq.length === 0) {
      return { text: base, values: [] };
    }
    let pn = 1;
    const conds = check.whereEq.map((w) => {
      const ph = nextPlaceholderRelational(dialect, pn++);
      const alias = w.side === "left" ? "L" : "R";
      return `${alias}.${qid(dialect, w.column)} = ${ph}`;
    });
    return {
      text: `${base} WHERE ${conds.join(" AND ")}`,
      values: check.whereEq.map((w) => w.value),
    };
  }

  const _exhaustive: never = check;
  return _exhaustive;
}

/** Sample SELECT for anti_join failures (anchor columns only). */
export function buildAntiJoinSampleSql(
  dialect: RelationalSqlDialect,
  check: ResolvedRelationalCheck & { checkKind: "anti_join" },
): { text: string; values: string[] } {
  const at = qid(dialect, check.anchorTable);
  const lt = qid(dialect, check.lookupTable);
  const condsOn: string[] = [];
  const values: string[] = [];
  let pn = 1;
  condsOn.push(`A.${qid(dialect, check.anchorColumn)} = L.${qid(dialect, check.lookupColumn)}`);
  for (const w of check.filterEqLookup) {
    condsOn.push(`L.${qid(dialect, w.column)} = ${nextPlaceholderRelational(dialect, pn++)}`);
    values.push(w.value);
  }
  const whereParts: string[] = [`L.${qid(dialect, check.lookupPresenceColumn)} IS NULL`];
  for (const w of check.filterEqAnchor) {
    whereParts.push(`A.${qid(dialect, w.column)} = ${nextPlaceholderRelational(dialect, pn++)}`);
    values.push(w.value);
  }
  const anchorColSet = new Set<string>([check.anchorColumn]);
  for (const w of check.filterEqAnchor) anchorColSet.add(w.column);
  const proj = [...anchorColSet].sort((a, b) => compareUtf16Id(a, b));
  const selectList = proj.map((c) => `A.${qid(dialect, c)}`).join(", ");
  const text = `SELECT ${selectList} FROM ${at} AS A LEFT JOIN ${lt} AS L ON ${condsOn.join(" AND ")} WHERE ${whereParts.join(" AND ")} LIMIT ${MAX_VERIFICATION_SAMPLE_ROWS}`;
  return { text, values };
}

function normalizeNumericActual(raw: unknown, ctx: string): { ok: true; n: number } | { ok: false } {
  if (raw === null || raw === undefined) {
    return { ok: false };
  }
  if (typeof raw === "boolean") {
    return { ok: true, n: raw ? 1 : 0 };
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { ok: true, n: raw };
  }
  if (typeof raw === "bigint") {
    if (raw >= BigInt(Number.MIN_SAFE_INTEGER) && raw <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return { ok: true, n: Number(raw) };
    }
    return { ok: false };
  }
  return { ok: false };
}

function compareExpect(actual: number, op: "eq" | "gte" | "lte", expected: number): boolean {
  if (op === "eq") return actual === expected;
  if (op === "gte") return actual >= expected;
  return actual <= expected;
}

export function reconcileRelationalRow(
  row: Record<string, unknown> | undefined,
  check: ResolvedRelationalCheck,
): ReconcileOutput {
  const id = check.id;
  if (row === undefined) {
    return {
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.RELATIONAL_SCALAR_UNUSABLE,
          message: formatOperationalMessage(`Relational check ${id}: no result row`),
        },
      ],
      evidenceSummary: { checkId: id, checkKind: check.checkKind },
    };
  }

  const vRaw = row.v ?? row.V;
  if (check.checkKind === "related_exists") {
    const norm = normalizeNumericActual(vRaw, id);
    if (!norm.ok || (norm.n !== 0 && norm.n !== 1)) {
      return {
        status: "incomplete_verification",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.RELATIONAL_SCALAR_UNUSABLE,
            message: formatOperationalMessage(`Relational check ${id}: EXISTS result not boolean/0/1`),
          },
        ],
        evidenceSummary: { checkId: id, checkKind: check.checkKind, raw: vRaw },
      };
    }
    if (norm.n === 1) {
      return { status: "verified", reasons: [], evidenceSummary: { checkId: id, checkKind: check.checkKind, v: 1 } };
    }
    return {
      status: "missing",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.RELATED_ROWS_ABSENT,
          message: formatOperationalMessage(`Relational check ${id}: related row does not exist`),
        },
      ],
      evidenceSummary: { checkId: id, checkKind: check.checkKind, v: 0 },
    };
  }

  if (check.checkKind === "anti_join") {
    const norm = normalizeNumericActual(vRaw, id);
    if (!norm.ok) {
      return {
        status: "incomplete_verification",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.RELATIONAL_SCALAR_UNUSABLE,
            message: formatOperationalMessage(`Relational check ${id}: non-numeric anti_join count`),
          },
        ],
        evidenceSummary: { checkId: id, checkKind: check.checkKind, raw: vRaw },
      };
    }
    if (norm.n === 0) {
      return {
        status: "verified",
        reasons: [],
        evidenceSummary: { checkId: id, checkKind: check.checkKind, orphanRowCount: 0 },
      };
    }
    return {
      status: "inconsistent",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.ORPHAN_ROW_DETECTED,
          message: formatOperationalMessage(`Relational check ${id}: ${norm.n} orphan row(s)`),
        },
      ],
      evidenceSummary: {
        checkId: id,
        checkKind: check.checkKind,
        orphanRowCount: norm.n,
      },
    };
  }

  const norm = normalizeNumericActual(vRaw, id);
  if (!norm.ok) {
    return {
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.RELATIONAL_SCALAR_UNUSABLE,
          message: formatOperationalMessage(`Relational check ${id}: non-numeric aggregate result`),
        },
      ],
      evidenceSummary: { checkId: id, checkKind: check.checkKind, raw: vRaw },
    };
  }

  const ok = compareExpect(norm.n, check.expectOp, check.expectValue);
  if (!ok) {
    return {
      status: "inconsistent",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.RELATIONAL_EXPECTATION_MISMATCH,
          message: formatOperationalMessage(
            `Relational check ${id}: expected ${check.expectOp} ${check.expectValue} but actual ${norm.n}`,
          ),
        },
      ],
      evidenceSummary: {
        checkId: id,
        checkKind: check.checkKind,
        actual: norm.n,
        expected: check.expectValue,
        op: check.expectOp,
      },
    };
  }

  return {
    status: "verified",
    reasons: [],
    evidenceSummary: {
      checkId: id,
      checkKind: check.checkKind,
      actual: norm.n,
      expected: check.expectValue,
      op: check.expectOp,
    },
  };
}

function mergeAntiJoinSamples(base: ReconcileOutput, sampleRows: Record<string, unknown>[]): ReconcileOutput {
  return {
    ...base,
    evidenceSummary: {
      ...base.evidenceSummary,
      sampleRows,
    },
  };
}

export function reconcileRelationalSqlite(db: DatabaseSync, check: ResolvedRelationalCheck): ReconcileOutput {
  const { text, values } = buildRelationalScalarSql("sqlite", check);
  try {
    const stmt = db.prepare(text);
    const row = stmt.get(...values) as Record<string, unknown> | undefined;
    const lowered =
      row === undefined
        ? undefined
        : Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
    let out = reconcileRelationalRow(lowered, check);
    if (
      check.checkKind === "anti_join" &&
      out.status === "inconsistent" &&
      out.reasons[0]?.code === SQL_VERIFICATION_OUTCOME_CODE.ORPHAN_ROW_DETECTED
    ) {
      const { text: st, values: sv } = buildAntiJoinSampleSql("sqlite", check);
      const sampleStmt = db.prepare(st);
      const sampleRaw = sampleStmt.all(...sv) as Record<string, unknown>[];
      const sampleRows = sampleRaw.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])),
      );
      out = mergeAntiJoinSamples(out, sampleRows);
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.CONNECTOR_ERROR,
          message: formatOperationalMessage(msg),
        },
      ],
      evidenceSummary: { checkId: check.id, checkKind: check.checkKind, error: true },
    };
  }
}

type RowsQuery = (text: string, values: string[]) => Promise<{ rows: Record<string, unknown>[] }>;

export async function reconcileRelationalQuery(
  dialect: RelationalSqlDialect,
  query: RowsQuery,
  check: ResolvedRelationalCheck,
): Promise<ReconcileOutput> {
  const { text, values } = buildRelationalScalarSql(dialect, check);
  try {
    const r = await query(text, values);
    const row0 = r.rows[0];
    const lowered =
      row0 === undefined
        ? undefined
        : Object.fromEntries(Object.entries(row0).map(([k, v]) => [k.toLowerCase(), v]));
    let out = reconcileRelationalRow(lowered, check);
    if (
      check.checkKind === "anti_join" &&
      out.status === "inconsistent" &&
      out.reasons[0]?.code === SQL_VERIFICATION_OUTCOME_CODE.ORPHAN_ROW_DETECTED
    ) {
      const { text: st, values: sv } = buildAntiJoinSampleSql(dialect, check);
      const sr = await query(st, sv);
      const sampleRows = sr.rows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])),
      );
      out = mergeAntiJoinSamples(out, sampleRows);
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.CONNECTOR_ERROR,
          message: formatOperationalMessage(msg),
        },
      ],
      evidenceSummary: { checkId: check.id, checkKind: check.checkKind, error: true },
    };
  }
}

type PgClientLike = { query: (text: string, values: string[]) => Promise<{ rows: Record<string, unknown>[] }> };

export async function reconcileRelationalPostgres(
  client: PgClientLike,
  check: ResolvedRelationalCheck,
): Promise<ReconcileOutput> {
  return reconcileRelationalQuery("postgresql", (t, v) => client.query(t, v), check);
}

export async function reconcileRelationalMysql2(pool: Mysql2Pool, check: ResolvedRelationalCheck): Promise<ReconcileOutput> {
  return reconcileRelationalQuery("mysql", async (t, v) => {
    const [rows] = await pool.query(t, v);
    return { rows: rows as Record<string, unknown>[] };
  }, check);
}

