import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESTRUCTIVE_POSTGRES_URL_REFUSAL_PREAMBLE,
  destructivePostgresUrlEscapeHatchEnabled,
  destructivePostgresUrlViolations,
  hostOfPostgresUrl,
} from "../scripts/assert-destructive-postgres-urls.mjs";

describe("assert-destructive-postgres-urls", () => {
  it("allows localhost and 127.0.0.1 and ::1", () => {
    const v = destructivePostgresUrlViolations(
      [
        { name: "DATABASE_URL", raw: "postgresql://localhost:5432/x" },
        { name: "TELEMETRY_DATABASE_URL", raw: "postgres://127.0.0.1:5432/y" },
        { name: "OTHER", raw: "postgresql://[::1]:5432/z" },
      ],
      {},
    );
    assert.deepEqual(v, []);
  });

  it("rejects remote hosts", () => {
    const v = destructivePostgresUrlViolations(
      [{ name: "DATABASE_URL", raw: "postgresql://db.example.com:5432/prod" }],
      {},
    );
    assert.equal(v.length, 1);
    assert.match(v[0], /DATABASE_URL: non-loopback host "db\.example\.com"/);
  });

  it("fails closed: local DATABASE_URL + remote TELEMETRY_DATABASE_URL", () => {
    const v = destructivePostgresUrlViolations(
      [
        { name: "DATABASE_URL", raw: "postgresql://127.0.0.1:5432/core" },
        { name: "TELEMETRY_DATABASE_URL", raw: "postgresql://db.supabase.co:5432/telemetry" },
      ],
      {},
    );
    assert.equal(v.length, 1);
    assert.match(v[0], /TELEMETRY_DATABASE_URL/);
    assert.match(v[0], /supabase/);
  });

  it("fails closed: remote DATABASE_URL + empty TELEMETRY_DATABASE_URL", () => {
    const v = destructivePostgresUrlViolations(
      [
        { name: "DATABASE_URL", raw: "postgresql://remote.example/db" },
        { name: "TELEMETRY_DATABASE_URL", raw: "" },
      ],
      {},
    );
    assert.equal(v.length, 1);
    assert.match(v[0], /DATABASE_URL/);
  });

  it("fails closed: empty DATABASE_URL + remote TELEMETRY_DATABASE_URL", () => {
    const v = destructivePostgresUrlViolations(
      [
        { name: "DATABASE_URL", raw: "" },
        { name: "TELEMETRY_DATABASE_URL", raw: "postgresql://pooler.supabase.com:6543/telemetry" },
      ],
      {},
    );
    assert.equal(v.length, 1);
    assert.match(v[0], /TELEMETRY_DATABASE_URL/);
  });

  it("exports an explicit refusal preamble for tooling/CI", () => {
    assert.match(
      DESTRUCTIVE_POSTGRES_URL_REFUSAL_PREAMBLE,
      /non-loopback host/,
    );
    assert.match(DESTRUCTIVE_POSTGRES_URL_REFUSAL_PREAMBLE, /ALLOW_DESTRUCTIVE_TESTS=1/);
  });

  it("skips empty URL entries", () => {
    const v = destructivePostgresUrlViolations([{ name: "TELEMETRY_DATABASE_URL", raw: "" }], {});
    assert.deepEqual(v, []);
  });

  it("escape hatch disables host enforcement", () => {
    const env = { ALLOW_DESTRUCTIVE_TESTS: "1" };
    assert.equal(destructivePostgresUrlEscapeHatchEnabled(env), true);
    const v = destructivePostgresUrlViolations(
      [{ name: "DATABASE_URL", raw: "postgresql://evil.remote/db" }],
      env,
    );
    assert.deepEqual(v, []);
  });

  it("hostOfPostgresUrl parses postgres scheme", () => {
    assert.equal(hostOfPostgresUrl("postgres://user:pass@127.0.0.1:5433/db"), "127.0.0.1");
  });
});
