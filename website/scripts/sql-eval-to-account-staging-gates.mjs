#!/usr/bin/env node
/**
 * RR-F / SP operator SQL gates for eval-to-account (D_ihm mint cohort).
 * Usage: node scripts/sql-eval-to-account-staging-gates.mjs -- --gate-set=rr|sp
 */
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

const gateSet =
  process.argv.includes("--gate-set=sp") ? "sp"
  : process.argv.includes("--gate-set=rr") ? "rr"
  : "rr";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("sql-eval-to-account-staging-gates: DATABASE_URL is required");
  process.exit(1);
}

function hashSecret(secret) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

const sql = postgres(url, { max: 1 });

const TH = {
  SP_R0: 0.97,
  SP_R0b: 1.0,
  SP_R1a: 0.65,
  SP_R1b: 0.42,
  SP_R1c: 120,
  SP_R2: 0.98,
};

/** RR seed isolation: only rows minted by this script (`run_id` prefix). */
function dIhmRrWhere(alias = "t") {
  return `${alias}.interactive_human_claim = true
    AND ${alias}.telemetry_source IS DISTINCT FROM 'local_dev'
    AND ${alias}.run_id NOT LIKE 'e2e:%'
    AND ${alias}.run_id LIKE $3
    AND ${alias}.created_at >= $1::timestamptz
    AND ${alias}.created_at < $2::timestamptz`;
}

function dIhmProdWhere(alias = "t") {
  return `${alias}.interactive_human_claim = true
    AND ${alias}.telemetry_source IS DISTINCT FROM 'local_dev'
    AND ${alias}.run_id NOT LIKE 'e2e:%'
    AND ${alias}.created_at >= $1::timestamptz
    AND ${alias}.created_at < $2::timestamptz`;
}

async function main() {
  const tag = `rr_sql_gate_${Date.now()}`;
  const windowEnd = new Date(Date.now() + 5 * 60 * 1000);
  const windowStart = new Date(windowEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
  const dIhm = gateSet === "rr" ? dIhmRrWhere : dIhmProdWhere;
  const wParams =
    gateSet === "rr" ? [windowStart.toISOString(), windowEnd.toISOString(), `${tag}:%`] : [windowStart.toISOString(), windowEnd.toISOString()];

  if (gateSet === "sp") {
    const cnt = await sql.unsafe(
      `SELECT COUNT(*)::int AS c FROM oss_claim_ticket t WHERE ${dIhmProdWhere("t")}`,
      [windowStart.toISOString(), windowEnd.toISOString()],
    );
    if (Number(cnt[0].c) === 0) {
      console.log("SP mode: zero D_ihm rows in window — skipping gate math (exit 0).");
      await sql.end({ timeout: 5 });
      return;
    }
    console.log("SP mode: evaluating D_ihm window on live rows. SP-R3/R4: operator SQL in journey SSOT — skipped here.");
  }

  const userId = `rr_gate_user_${tag}`;
  const sessionTok = `rr_gate_sess_${tag}`;

  try {
    if (gateSet === "rr") {
      const secretHashes = [];
      for (let i = 0; i < 100; i++) {
        secretHashes.push(hashSecret(randomBytes(32).toString("hex")));
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(
          `INSERT INTO "user" ("id", "email", "emailVerified", "name", "image", "plan", "stripe_customer_id", "stripe_subscription_id", "stripe_price_id", "subscription_status")
         VALUES ($1, $2, now(), null, null, 'starter', null, null, null, 'none')`,
          [userId, `${tag}@example.com`],
        );

        const nowBase = Date.now();
        const issuedAt = new Date().toISOString();
        for (let i = 0; i < 100; i++) {
          const createdMs = nowBase - i * 1000;
          const created = new Date(createdMs).toISOString();
          const expiresAt = new Date(createdMs + 72 * 60 * 60 * 1000).toISOString();
          const ack = new Date(createdMs + 5000).toISOString();
          const handoff = new Date(createdMs + 15000).toISOString();
          const claimed = i < 98 ? new Date(createdMs + 25000).toISOString() : null;
          const uid = i < 98 && i % 10 === 0 ? userId : null;
          await tx.unsafe(
            `INSERT INTO oss_claim_ticket (
            secret_hash, run_id, terminal_status, workload_class, subcommand, build_profile, issued_at,
            telemetry_source, created_at, expires_at, claimed_at, user_id, handoff_token, handoff_consumed_at,
            interactive_human_claim, browser_open_invoked_at
          ) VALUES (
            $1, $2, 'complete', 'non_bundled', 'batch_verify', 'oss', $3,
            'unknown', $4::timestamptz, $5::timestamptz, $6, $7, $8, $9::timestamptz,
            true, $10::timestamptz
          )`,
            [
              secretHashes[i],
              `${tag}:r${i}`,
              issuedAt,
              created,
              expiresAt,
              claimed,
              uid,
              `tok_${tag}_${i}`,
              handoff,
              ack,
            ],
          );
        }

        const exp = new Date(nowBase + 30 * 86400000).toISOString();
        const sessCreated = new Date(nowBase - 7 * 86400000).toISOString();
        await tx.unsafe(
          `INSERT INTO "session" ("sessionToken", "userId", "expires", "created_at")
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz)`,
          [sessionTok, userId, exp, sessCreated],
        );
      });
    }

    const gates = [];

    const r0 = await sql.unsafe(
      `SELECT (COUNT(*) FILTER (WHERE browser_open_invoked_at IS NOT NULL))::float / NULLIF(COUNT(*), 0) AS v
       FROM oss_claim_ticket t WHERE ${dIhm("t")}`,
      wParams,
    );
    gates.push({ id: "SP-R0", v: Number(r0[0].v), pass: Number(r0[0].v) >= TH.SP_R0 });

    const r0b = await sql.unsafe(
      `SELECT COALESCE(
        (COUNT(*) FILTER (WHERE handoff_consumed_at >= browser_open_invoked_at))::float
        / NULLIF(COUNT(*) FILTER (WHERE browser_open_invoked_at IS NOT NULL AND handoff_consumed_at IS NOT NULL), 0),
        1.0) AS v
       FROM oss_claim_ticket t WHERE ${dIhm("t")}`,
      wParams,
    );
    gates.push({ id: "SP-R0b", v: Number(r0b[0].v), pass: Math.abs(Number(r0b[0].v) - TH.SP_R0b) < 1e-9 });

    const r1a = await sql.unsafe(
      `SELECT (COUNT(*) FILTER (WHERE handoff_consumed_at IS NOT NULL AND handoff_consumed_at - created_at <= interval '2 minutes'))::float
        / NULLIF(COUNT(*), 0) AS v
       FROM oss_claim_ticket t WHERE ${dIhm("t")}`,
      wParams,
    );
    gates.push({ id: "SP-R1a", v: Number(r1a[0].v), pass: Number(r1a[0].v) >= TH.SP_R1a });

    const r1cRow = await sql.unsafe(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (handoff_consumed_at - created_at))) AS p50
       FROM oss_claim_ticket t WHERE ${dIhm("t")} AND handoff_consumed_at IS NOT NULL`,
      wParams,
    );
    const p50 = r1cRow[0].p50 === null ? 0 : Number(r1cRow[0].p50);
    gates.push({ id: "SP-R1c", v: p50, pass: p50 <= TH.SP_R1c });

    const r2 = await sql.unsafe(
      `SELECT (COUNT(*) FILTER (WHERE claimed_at IS NOT NULL))::float
        / NULLIF(COUNT(*) FILTER (WHERE handoff_consumed_at IS NOT NULL), 0) AS v
       FROM oss_claim_ticket t WHERE ${dIhm("t")}`,
      wParams,
    );
    gates.push({ id: "SP-R2", v: Number(r2[0].v), pass: Number(r2[0].v) >= TH.SP_R2 });

    const r1b = await sql.unsafe(
      `WITH d AS (
         SELECT t.*
         FROM oss_claim_ticket t
         WHERE ${dIhm("t")}
           AND t.handoff_consumed_at IS NOT NULL
           AND t.claimed_at IS NOT NULL
           AND t.user_id IS NOT NULL
       )
       SELECT (COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM "session" s
         WHERE s."userId" = d.user_id
           AND (
             (s.created_at >= d.handoff_consumed_at AND s.created_at <= d.claimed_at)
             OR (s.created_at < d.handoff_consumed_at AND s.expires > d.claimed_at)
           )
       )))::float / NULLIF(COUNT(*), 0) AS v
       FROM d`,
      wParams,
    );
    gates.push({ id: "SP-R1b", v: Number(r1b[0].v), pass: Number(r1b[0].v) >= TH.SP_R1b });

    const rrIds = new Set(["SP-R0", "SP-R0b", "SP-R1a", "SP-R1b", "SP-R1c", "SP-R2"]);

    let anyFail = false;
    for (const g of gates) {
      if (gateSet === "rr" && !rrIds.has(g.id)) continue;
      if (gateSet === "sp" && !rrIds.has(g.id)) {
        /* SP-R3/R4 not seeded in CI — skip evaluation */
        continue;
      }
      const ok = g.pass;
      if (!ok) anyFail = true;
      console.log(`${g.id}: ${g.v} → ${ok ? "PASS" : "FAIL"}`);
    }

    if (gateSet === "sp") {
      console.log("SP-R3/R4a/R4b: not evaluated in this script (business-outcome SQL lives in journey SSOT).");
    }

    if (anyFail) process.exitCode = 1;
  } finally {
    if (gateSet === "rr") {
      await sql.unsafe(`DELETE FROM oss_claim_ticket WHERE run_id LIKE $1`, [`${tag}:%`]);
      await sql.unsafe(`DELETE FROM "session" WHERE "sessionToken" = $1`, [sessionTok]);
      await sql.unsafe(`DELETE FROM "user" WHERE "id" = $1`, [userId]);
    }
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
