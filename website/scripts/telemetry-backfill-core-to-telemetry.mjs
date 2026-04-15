#!/usr/bin/env node
/**
 * Copy telemetry-tier `funnel_event` rows + activation beacons from core `DATABASE_URL`
 * into `TELEMETRY_DATABASE_URL`.
 *
 * Preconditions: telemetry DB empty for those tables; `AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE=1`.
 * Postcondition: per-event funnel counts + beacon table counts match core vs telemetry.
 *
 * See docs/telemetry-storage-ssot.md.
 */
import postgres from "postgres";

const TELEMETRY_EVENTS = [
  "demo_verify_ok",
  "acquisition_landed",
  "integrate_landed",
  "verify_started",
  "verify_outcome",
];

function bail(msg) {
  console.error(msg);
  process.exit(1);
}

const coreUrl = process.env.DATABASE_URL?.trim();
const telemetryUrl = process.env.TELEMETRY_DATABASE_URL?.trim();

if (!coreUrl) bail("telemetry-backfill: DATABASE_URL is required");
if (!telemetryUrl) bail("telemetry-backfill: TELEMETRY_DATABASE_URL is required");
if (process.env.AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE !== "1") {
  bail("telemetry-backfill: set AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE=1");
}

const core = postgres(coreUrl, { max: 3 });
const tele = postgres(telemetryUrl, { max: 3 });

async function countTelemetryFunnel(sql) {
  const [row] = await sql`
    SELECT count(*)::int AS n FROM funnel_event WHERE event IN ${sql(TELEMETRY_EVENTS)}
  `;
  return row.n;
}

async function countStarted(sql) {
  const [row] = await sql`SELECT count(*)::int AS n FROM product_activation_started_beacon`;
  return row.n;
}

async function countOutcome(sql) {
  const [row] = await sql`SELECT count(*)::int AS n FROM product_activation_outcome_beacon`;
  return row.n;
}

async function countPerEvent(sql) {
  const rows = await sql`
    SELECT event, count(*)::int AS n
    FROM funnel_event
    WHERE event IN ${sql(TELEMETRY_EVENTS)}
    GROUP BY event
  `;
  const m = new Map();
  for (const r of rows) {
    m.set(r.event, r.n);
  }
  return m;
}

try {
  const tFe = await countTelemetryFunnel(tele);
  const tSb = await countStarted(tele);
  const tOb = await countOutcome(tele);
  if (tFe !== 0 || tSb !== 0 || tOb !== 0) {
    bail("telemetry-backfill: telemetry DB must start empty for telemetry-tier funnel + beacons");
  }

  const funnelRows = await core`
    SELECT id, event, user_id, install_id, metadata, created_at,
      coalesce(server_vercel_env, 'unset') AS server_vercel_env,
      coalesce(server_node_env, 'unset') AS server_node_env
    FROM funnel_event
    WHERE event IN ${core(TELEMETRY_EVENTS)}
  `;

  for (const r of funnelRows) {
    await tele`
      INSERT INTO funnel_event (id, event, user_id, install_id, metadata, created_at, server_vercel_env, server_node_env)
      VALUES (
        ${r.id},
        ${r.event},
        ${r.user_id},
        ${r.install_id},
        ${r.metadata},
        ${r.created_at},
        ${r.server_vercel_env},
        ${r.server_node_env}
      )
    `;
  }

  const startedRows = await core`SELECT run_id, created_at FROM product_activation_started_beacon`;
  for (const r of startedRows) {
    await tele`
      INSERT INTO product_activation_started_beacon (run_id, created_at)
      VALUES (${r.run_id}, ${r.created_at})
    `;
  }

  const outcomeRows = await core`SELECT run_id, created_at FROM product_activation_outcome_beacon`;
  for (const r of outcomeRows) {
    await tele`
      INSERT INTO product_activation_outcome_beacon (run_id, created_at)
      VALUES (${r.run_id}, ${r.created_at})
    `;
  }

  const cFe = await countTelemetryFunnel(core);
  const cSb = await countStarted(core);
  const cOb = await countOutcome(core);
  const xFe = await countTelemetryFunnel(tele);
  const xSb = await countStarted(tele);
  const xOb = await countOutcome(tele);

  if (cFe !== xFe || cSb !== xSb || cOb !== xOb) {
    bail(
      `telemetry-backfill: aggregate count mismatch core(fe=${cFe},sb=${cSb},ob=${cOb}) vs telemetry(fe=${xFe},sb=${xSb},ob=${xOb})`,
    );
  }

  const cMap = await countPerEvent(core);
  const xMap = await countPerEvent(tele);
  for (const ev of TELEMETRY_EVENTS) {
    const a = cMap.get(ev) ?? 0;
    const b = xMap.get(ev) ?? 0;
    if (a !== b) {
      bail(`telemetry-backfill: per-event mismatch for ${ev}: core=${a} telemetry=${b}`);
    }
  }

  console.log("telemetry-backfill: ok");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await core.end({ timeout: 5 });
  await tele.end({ timeout: 5 });
}
