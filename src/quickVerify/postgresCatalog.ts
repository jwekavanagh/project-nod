import type pg from "pg";
import type { ColumnInfo, FkEdge, SchemaCatalog, UniqueConstraint } from "./schemaCatalogTypes.js";

/**
 * Schema introspection for Quick Verify using pg_catalog + privilege checks.
 * information_schema joins that omit `table_name` can mis-associate constraints across tables
 * (PostgreSQL allows the same constraint name on different tables). SELECT-only roles also
 * rely on stable visibility of tables they may read — pg_catalog + has_table_privilege matches that.
 */
export class PostgresSchemaCatalog implements SchemaCatalog {
  readonly dialect = "postgres" as const;

  constructor(private readonly client: pg.Client) {}

  async listTables(): Promise<string[]> {
    const r = await this.client.query(
      `SELECT c.relname AS table_name
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND NOT c.relispartition
         AND pg_catalog.has_table_privilege(c.oid, 'SELECT')
       ORDER BY c.relname`,
    );
    return (r.rows as { table_name: string }[]).map((x) => x.table_name);
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const r = await this.client.query(
      `SELECT a.attname AS column_name
       FROM pg_catalog.pg_attribute a
       JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = $1
         AND c.relkind = 'r'
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [table],
    );
    return (r.rows as { column_name: string }[]).map((x) => ({ name: x.column_name }));
  }

  async primaryKeyColumns(table: string): Promise<string[]> {
    const r = await this.client.query(
      `SELECT a.attname AS column_name
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_index i ON i.indrelid = c.oid AND i.indisprimary
       JOIN pg_catalog.pg_attribute a
         ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey) AND a.attnum > 0 AND NOT a.attisdropped
       WHERE n.nspname = 'public'
         AND c.relname = $1
         AND c.relkind = 'r'`,
      [table],
    );
    return (r.rows as { column_name: string }[]).map((x) => x.column_name);
  }

  async listUniqueConstraints(table: string): Promise<UniqueConstraint[]> {
    const r = await this.client.query(
      `SELECT cn.conname, a.attname, u.ord
       FROM pg_catalog.pg_constraint cn
       JOIN pg_catalog.pg_class c ON c.oid = cn.conrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN LATERAL unnest(cn.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
       JOIN pg_catalog.pg_attribute a
         ON a.attrelid = c.oid AND a.attnum = u.attnum AND NOT a.attisdropped
       WHERE n.nspname = 'public'
         AND c.relname = $1
         AND c.relkind = 'r'
         AND cn.contype = 'u'
       ORDER BY cn.conname, u.ord`,
      [table],
    );
    const byName = new Map<string, string[]>();
    for (const row of r.rows as { conname: string; attname: string }[]) {
      const arr = byName.get(row.conname) ?? [];
      arr.push(row.attname);
      byName.set(row.conname, arr);
    }
    return [...byName.values()].map((columns) => ({ columns }));
  }

  async listFkEdges(): Promise<FkEdge[]> {
    const r = await this.client.query(
      `SELECT
         cl.relname AS child_table,
         a.attname AS child_column,
         pr.relname AS parent_table,
         pa.attname AS parent_column
       FROM pg_catalog.pg_constraint cn
       JOIN pg_catalog.pg_class cl ON cl.oid = cn.conrelid
       JOIN pg_catalog.pg_namespace ns ON ns.oid = cl.relnamespace
       JOIN pg_catalog.pg_class pr ON pr.oid = cn.confrelid AND pr.relkind = 'r'
       JOIN LATERAL unnest(cn.conkey, cn.confkey) AS u(att_child, att_parent) ON true
       JOIN pg_catalog.pg_attribute a
         ON a.attrelid = cl.oid AND a.attnum = u.att_child AND NOT a.attisdropped
       JOIN pg_catalog.pg_attribute pa
         ON pa.attrelid = pr.oid AND pa.attnum = u.att_parent AND NOT pa.attisdropped
       WHERE cn.contype = 'f'
         AND ns.nspname = 'public'
         AND pg_catalog.has_table_privilege(cl.oid, 'SELECT')
         AND pg_catalog.has_table_privilege(pr.oid, 'SELECT')
       ORDER BY cl.relname, a.attname, pr.relname, pa.attname`,
    );
    const out: FkEdge[] = [];
    const seen = new Set<string>();
    for (const row of r.rows as {
      child_table: string;
      child_column: string;
      parent_table: string;
      parent_column: string;
    }[]) {
      const key = `${row.child_table}.${row.child_column}->${row.parent_table}.${row.parent_column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        childTable: row.child_table,
        childColumn: row.child_column,
        parentTable: row.parent_table,
        parentColumn: row.parent_column,
      });
    }
    return out;
  }
}
