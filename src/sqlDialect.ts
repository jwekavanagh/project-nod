export type RelationalSqlDialect = "sqlite" | "postgresql" | "mysql" | "mssql";

export type SqlRowDialect = "sqlite" | "postgresql" | "mysql" | "mssql" | "bigquery";

export function quoteIdent(dialect: SqlRowDialect | RelationalSqlDialect, id: string): string {
  if (dialect === "mysql") {
    return "`" + id.replace(/`/g, "``") + "`";
  }
  if (dialect === "mssql") {
    return "[" + id.replace(/\]/g, "]]") + "]";
  }
  if (dialect === "bigquery") {
    // GoogleSQL delimited identifiers: escape ` by doubling (``).
    return "`" + id.replace(/`/g, "``") + "`";
  }
  return `"${id.replace(/"/g, '""')}"`;
}

/** BigQuery table id may be `project.dataset.table` — quote each segment. */
export function quoteBigQueryTableId(full: string): string {
  const parts = full.split(".").filter(Boolean);
  if (parts.length === 0) return "`invalid`";
  return parts.map((p) => "`" + p.replace(/`/g, "``") + "`").join(".");
}

export function nextPlaceholderSqlRow(dialect: SqlRowDialect, n: number): string {
  if (dialect === "postgresql") return `$${n}`;
  if (dialect === "bigquery") return `@p${n}`;
  return "?";
}

export function nextPlaceholderRelational(dialect: RelationalSqlDialect, n: number): string {
  if (dialect === "postgresql") return `$${n}`;
  if (dialect === "mysql" || dialect === "sqlite") return "?";
  if (dialect === "mssql") return `@p${n}`;
  return "?";
}
