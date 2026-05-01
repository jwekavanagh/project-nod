import mysql from "mysql2/promise";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { ConnectorError } from "./sqlConnector.js";
import { connectPostgresVerificationClient, createPostgresSqlReadBackend } from "./sqlReadBackend.js";
import { executeRowAbsentRemote } from "./reconciler.js";
import type { ReconcileOutput } from "./reconciler.js";
import { reconcileRelationalMysql2, reconcileRelationalPostgres } from "./relationalInvariant.js";
import type { ResolvedRelationalCheck, RowAbsentVerificationRequest, VerificationDatabase, VerificationRequest } from "./types.js";
import type { SqlReadBackend } from "./sqlReadBackend.js";
import { nextPlaceholderSqlRow, quoteIdent, type SqlRowDialect } from "./sqlDialect.js";
import { TruthLayerError } from "./truthLayerError.js";

export type VerificationSqlTarget = {
  sqlRead: SqlReadBackend;
  reconcileRelationalCheck: (check: ResolvedRelationalCheck) => Promise<ReconcileOutput>;
  close: () => Promise<void>;
};

function verificationConnectorNotShipped(kind: string): never {
  throw new TruthLayerError(
    CLI_OPERATIONAL_CODES.VERIFICATION_CONNECTOR_NOT_SHIPPED,
    `Verification connector "${kind}" is not shipped in this package build.`,
  );
}

function lowerRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])));
}

function buildSelectByIdentitySqlMysql(req: VerificationRequest): { text: string; values: string[] } {
  const dialect: SqlRowDialect = "mysql";
  const table = quoteIdent(dialect, req.table);
  const conds: string[] = [];
  const values: string[] = [];
  let p = 1;
  for (const pair of req.identityEq) {
    conds.push(`${table}.${quoteIdent(dialect, pair.column)} = ${nextPlaceholderSqlRow(dialect, p++)}`);
    values.push(String(pair.value));
  }
  return {
    text: `SELECT * FROM ${table} WHERE ${conds.join(" AND ")} LIMIT 2`,
    values,
  };
}

export async function openVerificationSqlTarget(database: VerificationDatabase): Promise<VerificationSqlTarget> {
  if (database.kind === "bigquery") {
    verificationConnectorNotShipped("bigquery");
  }
  if (database.kind === "sqlserver") {
    verificationConnectorNotShipped("sqlserver");
  }

  if (database.kind === "postgres") {
    const client = await connectPostgresVerificationClient(database.connectionString);
    const sqlRead = createPostgresSqlReadBackend(client);
    return {
      sqlRead,
      reconcileRelationalCheck: (check) => reconcileRelationalPostgres(client, check),
      close: async () => {
        try {
          await client.end();
        } catch {
          /* ignore */
        }
      },
    };
  }

  if (database.kind === "mysql") {
    const pool = await mysql.createPool(database.connectionString);
    const sqlRead: SqlReadBackend = {
      async fetchRows(req: VerificationRequest): Promise<Record<string, unknown>[]> {
        const { text, values } = buildSelectByIdentitySqlMysql(req);
        try {
          const [rows] = await pool.query(text, values);
          return lowerRows(rows as Record<string, unknown>[]);
        } catch (e) {
          throw new ConnectorError(e instanceof Error ? e.message : String(e), { cause: e });
        }
      },
      async reconcileRowAbsent(req: RowAbsentVerificationRequest): Promise<ReconcileOutput> {
        return executeRowAbsentRemote("mysql", async (t, v) => {
          const [rows] = await pool.query(t, v);
          return { rows: rows as Record<string, unknown>[] };
        }, req);
      },
    };
    return {
      sqlRead,
      reconcileRelationalCheck: (check) => reconcileRelationalMysql2(pool, check),
      close: async () => {
        await pool.end();
      },
    };
  }

  throw new Error(`openVerificationSqlTarget: unsupported database kind ${(database as VerificationDatabase).kind}`);
}
