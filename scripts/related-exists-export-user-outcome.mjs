/**
 * User-outcome gate: fixture has no tools.json; quick export + batch verify reaches complete with quick:rel verified.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const fixture = join(root, "test", "fixtures", "related-exists-export-user-outcome");
const baseline = join(fixture, "BASELINE.md");
const schemaPath = join(fixture, "schema.sql");
const inputPath = join(fixture, "input.ndjson");
const cliJs = join(root, "dist", "cli.js");

if (!existsSync(baseline)) {
  console.error("related-exists-export-user-outcome: missing BASELINE.md");
  process.exit(1);
}
const baselineText = readFileSync(baseline, "utf8");
if (!baselineText.includes("manual_registry_entries_required_for_same_contract_replay: 1")) {
  console.error("related-exists-export-user-outcome: BASELINE.md missing required quantification line");
  process.exit(1);
}
if (existsSync(join(fixture, "tools.json"))) {
  console.error("related-exists-export-user-outcome: fixture must not ship tools.json");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "qv-user-outcome-"));
const dbPath = join(tmp, "db.sqlite");
try {
  const db = new DatabaseSync(dbPath);
  db.exec(readFileSync(schemaPath, "utf8"));
  db.close();

  const reg = join(tmp, "reg.json");
  const ev = join(tmp, "ev.ndjson");
  const r1 = spawnSync(
    process.execPath,
    [cliJs, "quick", "--input", inputPath, "--db", dbPath, "--export-registry", reg, "--emit-events", ev, "--workflow-id", "quick-verify"],
    { encoding: "utf8", cwd: root, maxBuffer: 10_000_000 },
  );
  if (r1.status !== 0) {
    console.error("quick failed", r1.stderr);
    process.exit(1);
  }

  const r2 = spawnSync(
    process.execPath,
    [cliJs, "--workflow-id", "quick-verify", "--events", ev, "--registry", reg, "--db", dbPath],
    { encoding: "utf8", cwd: root, maxBuffer: 10_000_000 },
  );
  if (r2.status !== 0) {
    console.error("batch verify failed", r2.stderr);
    process.exit(1);
  }
  const batch = JSON.parse(r2.stdout.trim());
  if (batch.status !== "complete") {
    console.error("expected workflow complete, got", batch.status);
    process.exit(1);
  }
  const relStep = batch.steps.find((s) => typeof s.toolId === "string" && s.toolId.startsWith("quick:rel:"));
  if (!relStep || relStep.status !== "verified") {
    console.error("expected quick:rel step verified", JSON.stringify(batch.steps, null, 2));
    process.exit(1);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
