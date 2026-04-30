/**
 * TLS helpers for Postgres connection strings.
 *
 * **Runtime (`postgres.js`):** `sslmode=require` is enough — the driver maps it to TLS without strict
 * certificate-chain verification the same way `node-pg` does.
 *
 * **`drizzle-kit migrate` (`pg` driver):** With current `pg-connection-string`, `sslmode=require` is
 * treated as an alias for **`verify-full`**, which triggers `SELF_SIGNED_CERT_IN_CHAIN` against
 * Supabase on Vercel. Use **`ensureDatabaseUrlForNodePgDriver()`** which adds
 * **`uselibpqcompat=true`** (per upstream warning) so `require` follows libpq semantics.
 *
 * Supabase / Vercel: prefer `sslmode=require` on the URL; drizzle config adds `uselibpqcompat` only
 * for migrate, not for the app client (avoids sending unknown params to Postgres from `postgres.js`).
 *
 * Local Docker Postgres (localhost / 127.0.0.1) is left unchanged so dev DBs without TLS still work.
 *
 * Compose / internal hostnames such as **`postgres`** are not loopback but often have no TLS. Set
 * **`AGENTSKEPTIC_PG_NO_TLS_HOSTS`** to a comma-separated hostname list so runtime and Drizzle-kit
 * leave those URLs unchanged (see `compose.verification-replay.yml`).
 */

function postgresUrlSkipsMandatoryTls(
  connectionUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    const forParse = connectionUrl.replace(/^postgres(ql)?:\/\//i, "http://");
    const hostname = new URL(forParse).hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return true;
    }
    const raw = env.AGENTSKEPTIC_PG_NO_TLS_HOSTS?.trim();
    if (!raw) return false;
    for (const part of raw.split(",")) {
      const t = part.trim().toLowerCase();
      if (t && t === hostname) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isPostgresProtocol(connectionUrl: string): boolean {
  const p = connectionUrl.match(/^postgres(ql)?:/i)?.[0]?.toLowerCase();
  return p === "postgres:" || p === "postgresql:";
}

/**
 * For `postgres.js` (Next.js app): ensures `sslmode=require` on non-local URLs.
 */
export function ensureSslModeRequire(connectionUrl: string): string {
  const t = connectionUrl.trim();
  if (!t || !isPostgresProtocol(t)) {
    return t;
  }
  if (postgresUrlSkipsMandatoryTls(t)) {
    return t;
  }

  if (/[?&]sslmode=require(?:&|$)/i.test(t)) {
    return t;
  }
  if (/[?&]sslmode=/i.test(t)) {
    return t.replace(/([?&])sslmode=[^&]*/gi, "$1sslmode=require");
  }
  return `${t}${t.includes("?") ? "&" : "?"}sslmode=require`;
}

/**
 * For `drizzle-kit migrate` (`node-pg`): same as runtime for localhost; for remote hosts ensures
 * `sslmode=require` **and** `uselibpqcompat=true` so `pg` does not treat `require` as `verify-full`.
 */
export function ensureDatabaseUrlForNodePgDriver(connectionUrl: string): string {
  const t = connectionUrl.trim();
  if (!t || !isPostgresProtocol(t)) {
    return t;
  }
  if (postgresUrlSkipsMandatoryTls(t)) {
    return t;
  }

  let out = t;
  if (!/[?&]sslmode=require(?:&|$)/i.test(out)) {
    if (/[?&]sslmode=/i.test(out)) {
      out = out.replace(/([?&])sslmode=[^&]*/gi, "$1sslmode=require");
    } else {
      out = `${out}${out.includes("?") ? "&" : "?"}sslmode=require`;
    }
  }
  if (!/[?&]uselibpqcompat=true(?:&|$)/i.test(out)) {
    out = `${out}${out.includes("?") ? "&" : "?"}uselibpqcompat=true`;
  }
  return out;
}
