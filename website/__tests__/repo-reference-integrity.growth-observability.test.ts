import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function walkMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkMarkdownFiles(p));
    else if (name.isFile() && name.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** These substrings must not appear in scanned repo surfaces after cutover. */
const BANNED_REFERENCE_SUBSTRINGS = [
  "export:telemetry-daily-pack",
  "telemetry-daily-pack.md",
  "scripts/export-telemetry-daily-pack.mjs",
  "scripts/lib/telemetry-daily-pack-sql.mjs",
  "telemetry-daily-pack-sql-contract.test.ts",
  "telemetry-daily-pack-export.integration.test.ts",
  "growthMetricsSqlParity.test.ts",
  "growth-cross-surface.integration.test.ts",
  'from "@/lib/growthMetrics',
  "from '@/lib/growthMetrics",
  "website/src/lib/growthMetrics",
] as const;

const TELEMETRY_DAILY_PACK_LINK = /telemetry-daily-pack\.md\)/;

const ROOT_FILES_TO_SCAN = [
  "package.json",
  "test/fixtures/decision-ready-surfaces.json",
  "config/epistemic-contract-structure.json",
  "website/README.md",
  "AGENTS.md",
  "scripts/validate-commercial-funnel.mjs",
  "scripts/validate-epistemic-contract-structure.mjs",
  "docs/adoption-validation-spec.md",
] as const;

function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

describe("repo-reference-integrity.growth-observability", () => {
  const payloads: { label: string; body: string }[] = [];

  for (const rel of ROOT_FILES_TO_SCAN) {
    const body = readIfExists(join(repoRoot, rel));
    if (body !== null) payloads.push({ label: rel, body });
  }

  const websitePkg = readIfExists(join(repoRoot, "website", "package.json"));
  if (websitePkg !== null) payloads.push({ label: "website/package.json", body: websitePkg });

  for (const mdPath of walkMarkdownFiles(join(repoRoot, "docs"))) {
    payloads.push({ label: mdPath.slice(repoRoot.length + 1), body: readFileSync(mdPath, "utf8") });
  }

  it("no scanned file contains banned removed-artifact references", () => {
    for (const { label, body } of payloads) {
      for (const ban of BANNED_REFERENCE_SUBSTRINGS) {
        expect(body, `${label} must not contain: ${ban}`).not.toContain(ban);
      }
      expect(body, `${label} must not link to removed telemetry-daily-pack`).not.toMatch(
        TELEMETRY_DAILY_PACK_LINK,
      );
    }
  });
});
