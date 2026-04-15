import { db } from "@/db/client";
import { dbTelemetry } from "@/db/telemetryClient";
import { funnelEvents } from "@/db/schema";
import { telemetryFunnelEvents } from "@/db/telemetrySchema";
import type { FunnelEventName } from "@/lib/funnelEvents";
import { isCoreTierFunnelEvent, isTelemetryTierFunnelEvent } from "@/lib/funnelEventTier";
import { telemetryTierWritesUseTelemetryDatabase } from "@/lib/telemetryWritesConfig";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import * as telemetrySchema from "@/db/telemetrySchema";

export type AppDbClient = PostgresJsDatabase<typeof schema>;
export type TelemetryAppDbClient = PostgresJsDatabase<typeof telemetrySchema>;

export type LogFunnelEventInput = {
  event: FunnelEventName;
  userId?: string | null;
  /** Pseudonymous CLI machine id for activation telemetry only; null for other events. */
  installId?: string | null;
  metadata?: unknown;
};

export type LogFunnelEventOptions = {
  /**
   * When `"telemetry"`, telemetry-tier rows are written to `TELEMETRY_DATABASE_URL` (used by
   * product-activation beacons, which always live on the telemetry DB). Default follows
   * `AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB`.
   */
  telemetryTierDestination?: "core" | "telemetry";
};

function serverProvenance() {
  return {
    serverVercelEnv: process.env.VERCEL_ENV ?? "unset",
    serverNodeEnv: process.env.NODE_ENV ?? "unset",
  };
}

function resolveTelemetryTierDestination(
  opts: LogFunnelEventOptions | undefined,
): "core" | "telemetry" {
  if (opts?.telemetryTierDestination) {
    return opts.telemetryTierDestination;
  }
  return telemetryTierWritesUseTelemetryDatabase() ? "telemetry" : "core";
}

/**
 * Best-effort funnel logging without a transaction. Never throws on DB errors.
 * When `tx` is passed (webhook transaction), failures propagate so the caller can roll back.
 */
export async function logFunnelEvent(
  input: LogFunnelEventInput,
  tx?: AppDbClient | TelemetryAppDbClient,
  opts?: LogFunnelEventOptions,
): Promise<void> {
  const telemetryDest = resolveTelemetryTierDestination(opts);
  const useTelemetryDb = isTelemetryTierFunnelEvent(input.event) && telemetryDest === "telemetry";

  if (useTelemetryDb) {
    const client = (tx as TelemetryAppDbClient | undefined) ?? dbTelemetry;
    const run = () =>
      client.insert(telemetryFunnelEvents).values({
        event: input.event,
        userId: input.userId ?? null,
        installId: input.installId ?? null,
        metadata: input.metadata ?? null,
        ...serverProvenance(),
      });

    if (tx) {
      await run();
      return;
    }

    try {
      await run();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        JSON.stringify({
          kind: "funnel_event_drop",
          event: input.event,
          message,
        }),
      );
    }
    return;
  }

  const client = (tx as AppDbClient | undefined) ?? db;
  const base = {
    event: input.event,
    userId: input.userId ?? null,
    installId: input.installId ?? null,
    metadata: input.metadata ?? null,
  };
  const values = isCoreTierFunnelEvent(input.event)
    ? { ...base, ...serverProvenance() }
    : { ...base };

  const run = () => client.insert(funnelEvents).values(values);

  if (tx) {
    await run();
    return;
  }

  try {
    await run();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        kind: "funnel_event_drop",
        event: input.event,
        message,
      }),
    );
  }
}
