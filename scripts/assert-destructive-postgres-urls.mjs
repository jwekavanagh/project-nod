#!/usr/bin/env node
/**
 * Refuse destructive tooling (migrations under disposable assumptions, TRUNCATE-heavy Vitest,
 * pg-ci-init DDL) when any checked Postgres URL points at a non-loopback host, unless an
 * explicit escape hatch is set. Typical pairs: DATABASE_URL + TELEMETRY_DATABASE_URL;
 * POSTGRES_ADMIN_URL for pg-ci-init. See validate-commercial-funnel.mjs and website/__tests__/helpers.
 *
 * Escape hatch (either): AGENTSKEPTIC_ALLOW_NONLOCAL_COMMERCIAL_DB=1 | ALLOW_DESTRUCTIVE_TESTS=1
 */
/** Shown once in console / Error; detail lines name the specific env var. */
export const DESTRUCTIVE_POSTGRES_URL_REFUSAL_PREAMBLE =
  "Refusing destructive operation because a Postgres connection URL points to a non-loopback host. Use disposable local DBs (localhost / 127.0.0.1 / ::1), or set AGENTSKEPTIC_ALLOW_NONLOCAL_COMMERCIAL_DB=1 or ALLOW_DESTRUCTIVE_TESTS=1 only when targeting an intentionally disposable remote database.";

/** @type {ReadonlySet<string>} */
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function destructivePostgresUrlEscapeHatchEnabled(env = process.env) {
  return (
    env.AGENTSKEPTIC_ALLOW_NONLOCAL_COMMERCIAL_DB === "1" || env.ALLOW_DESTRUCTIVE_TESTS === "1"
  );
}

/** @param {string} raw */
export function hostOfPostgresUrl(raw) {
  const t = raw.trim();
  if (!t || !/^postgres(ql)?:/i.test(t)) return null;
  const forParse = t.replace(/^postgres(ql)?:\/\//i, "http://");
  try {
    return new URL(forParse).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * @param {{ name: string; raw: string | undefined }[]} pairs
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]} human-readable violation lines (empty if ok)
 */
export function destructivePostgresUrlViolations(pairs, env = process.env) {
  if (destructivePostgresUrlEscapeHatchEnabled(env)) {
    return [];
  }
  /** @type {string[]} */
  const out = [];
  for (const { name, raw } of pairs) {
    const v = raw?.trim() ?? "";
    if (v.length === 0) continue;
    const host = hostOfPostgresUrl(v);
    if (host === null) {
      out.push(`${name}: not a valid postgres URL`);
      continue;
    }
    if (!ALLOWED_HOSTS.has(host)) {
      out.push(`${name}: non-loopback host "${host}"`);
    }
  }
  return out;
}

/**
 * @param {{ name: string; raw: string | undefined }[]} pairs
 * @param {{ tool: string; env?: NodeJS.ProcessEnv | Record<string, string | undefined> }} opts
 */
export function assertDestructivePostgresUrlsOrExit(pairs, opts) {
  const env = opts.env ?? process.env;
  const v = destructivePostgresUrlViolations(pairs, env);
  if (v.length === 0) return;
  console.error(`${opts.tool}: ${DESTRUCTIVE_POSTGRES_URL_REFUSAL_PREAMBLE}\n${v.join("\n")}`);
  process.exit(1);
}

/**
 * @param {{ name: string; raw: string | undefined }[]} pairs
 * @param {{ tool: string; env?: NodeJS.ProcessEnv | Record<string, string | undefined> }} opts
 */
export function assertDestructivePostgresUrlsOrThrow(pairs, opts) {
  const env = opts.env ?? process.env;
  const v = destructivePostgresUrlViolations(pairs, env);
  if (v.length === 0) return;
  throw new Error(`${opts.tool}: ${DESTRUCTIVE_POSTGRES_URL_REFUSAL_PREAMBLE}\n${v.join("\n")}`);
}
