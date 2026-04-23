import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const growthSsoDocPath = join(repoRoot, "docs", "growth-metrics.md");

/** Every canonical metric section must have a following ```sql fence (see docs/growth-metrics.md). */
const CANONICAL_METRIC_IDS = [
  "ActiveInstalls_DistinctInstallId_VerifyStarted_Rolling7dUtc",
  "TimeToFirstVerifyOutcome_Seconds",
  "CrossSurface_ConversionRate_AcquisitionToIntegrate_Rolling7dUtc",
  "CrossSurface_ConversionRate_IntegrateToVerifyOutcome_Rolling7dUtc",
  "CrossSurface_ConversionRate_QualifiedIntegrateToVerifyOutcome_Rolling7dUtc",
  "CrossSurface_ConversionRate_QualifiedIntegrateToIntegratorScopedVerifyOutcome_Rolling7dUtc",
  "CrossSurface_ConversionRate_QualifiedIntegrateToVerifyStarted_Rolling7dUtc",
  "Counts_QualifiedVerifyOutcomesByTerminalStatus_Rolling7dUtc",
  "CrossSurface_ConversionRate_AcquisitionToVerifyOutcome_Rolling7dUtc",
  "Retention_ActiveReserveDays_ge2_Rolling28dUtc",
] as const;

const BANNED_SUBSTRINGS_IN_GROWTH_SSOT = [
  "website/src/lib/growthMetrics",
  "growthMetricsSqlParity",
  "export:telemetry-daily-pack",
  "telemetry-daily-pack.md",
  "export-telemetry-daily-pack.mjs",
  "telemetry-daily-pack-sql.mjs",
  "telemetry-daily-pack-sql-contract",
  "telemetry-daily-pack-export.integration",
  "growth-cross-surface.integration.test",
] as const;

const REQUIRED_SUBSTRINGS = [
  "### Operator execution contract (normative)",
  "Supabase MCP",
  "Cursor",
  "TELEMETRY_DATABASE_URL",
  "DATABASE_URL",
  "public.funnel_event",
  "**Core-tier prohibition for telemetry KPIs:**",
  "Operators MUST issue only **read-only** statements",
  "Operators MUST NOT run **`INSERT`**, **`UPDATE`**, **`DELETE`**, or **DDL**",
] as const;

const REQUIRED_WARNING_MARKERS = [
  "**Rolling 7d cross-surface KPIs in this document are not interchangeable with UTC calendar-day bounded aggregates.**",
] as const;

const REQUIRED_CORE_RETENTION_MARKER =
  "**Core-tier metric (`DATABASE_URL` only):**";

describe("growth-metrics.contract", () => {
  const md = readFileSync(growthSsoDocPath, "utf8");

  it("bans removed pipeline and mirror references in growth SSOT", () => {
    for (const s of BANNED_SUBSTRINGS_IN_GROWTH_SSOT) {
      expect(md, `banned substring in growth-metrics: ${s}`).not.toContain(s);
    }
  });

  it("requires normative operator execution contract strings", () => {
    for (const s of REQUIRED_SUBSTRINGS) {
      expect(md, `missing required substring: ${s}`).toContain(s);
    }
    for (const s of REQUIRED_WARNING_MARKERS) {
      expect(md, `missing required warning: ${s}`).toContain(s);
    }
    expect(md).toContain(REQUIRED_CORE_RETENTION_MARKER);
  });

  it("each canonical metric id has a following sql fence", () => {
    for (const id of CANONICAL_METRIC_IDS) {
      const re = new RegExp(`### ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?\`\`\`sql`, "m");
      expect(re.test(md), `metric section missing or has no sql fence: ${id}`).toBe(true);
    }
  });
});
