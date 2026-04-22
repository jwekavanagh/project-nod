/**
 * Validates docs/dependency-security-pins.json shape (Appendix A constraints).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const ALLOWED_FILES = new Set([
  "website/package.json",
  "package.json",
  "test/fixtures/langgraph-node-oracle/package.json",
]);
const ALLOWED_LOCKFILE = new Set(["root", "example"]);
const ALLOWED_MATCH = new Set(["everyInstanceExact", "websiteWorkspaceExact"]);
const ALLOWED_FLAGS = new Set(["", "g", "i", "m", "gi", "gm", "im", "gim"]);
const PATH_KEY = /^[A-Za-z0-9@._/-]+$/;
const ID_PATTERN = /^[a-z0-9_]+$/;

function load() {
  const p = path.join(repoRoot, "docs", "dependency-security-pins.json");
  if (!existsSync(p)) throw new Error("PIN_SCHEMA_CONTRACT missing docs/dependency-security-pins.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

test("dependency-security-pins manifest shape (Appendix A)", () => {
  const m = load();
  const top = new Set(Object.keys(m));
  const expectedTop = new Set(["schemaVersion", "packageJsonExact", "lockfileAssertions", "drizzleMachineChecks"]);
  if (top.size !== expectedTop.size || ![...expectedTop].every((k) => top.has(k))) {
    throw new Error(`PIN_SCHEMA_CONTRACT unexpected top-level keys: ${[...top].join(",")}`);
  }
  if (m.schemaVersion !== 1) throw new Error(`PIN_SCHEMA_CONTRACT schemaVersion expected 1`);

  if (!Array.isArray(m.packageJsonExact)) throw new Error("PIN_SCHEMA_CONTRACT packageJsonExact must be array");
  for (const e of m.packageJsonExact) {
    if (!ALLOWED_FILES.has(e.file)) throw new Error(`PIN_SCHEMA_CONTRACT packageJsonExact invalid file ${e.file}`);
    if (!Array.isArray(e.path) || e.path.length < 1) throw new Error("PIN_SCHEMA_CONTRACT packageJsonExact path");
    for (const seg of e.path) {
      if (typeof seg !== "string" || !PATH_KEY.test(seg)) {
        throw new Error(`PIN_SCHEMA_CONTRACT packageJsonExact bad path segment ${JSON.stringify(seg)}`);
      }
    }
    if (typeof e.value !== "string" || e.value.length < 1) throw new Error("PIN_SCHEMA_CONTRACT packageJsonExact value");
  }

  if (!Array.isArray(m.lockfileAssertions)) throw new Error("PIN_SCHEMA_CONTRACT lockfileAssertions must be array");
  for (const r of m.lockfileAssertions) {
    if (!ALLOWED_LOCKFILE.has(r.lockfile)) {
      throw new Error(`PIN_SCHEMA_CONTRACT lockfileAssertions bad lockfile ${r.lockfile}`);
    }
    if (typeof r.package !== "string" || r.package.length < 1) {
      throw new Error("PIN_SCHEMA_CONTRACT lockfileAssertions package");
    }
    if (!ALLOWED_MATCH.has(r.match)) throw new Error(`PIN_SCHEMA_CONTRACT lockfileAssertions bad match ${r.match}`);
    if (typeof r.exactVersion !== "string" || r.exactVersion.length < 1) {
      throw new Error("PIN_SCHEMA_CONTRACT lockfileAssertions exactVersion");
    }
    if (r.allowAbsent !== undefined && typeof r.allowAbsent !== "boolean") {
      throw new Error("PIN_SCHEMA_CONTRACT lockfileAssertions allowAbsent");
    }
  }

  if (!Array.isArray(m.drizzleMachineChecks) || m.drizzleMachineChecks.length < 1) {
    throw new Error("PIN_SCHEMA_CONTRACT drizzleMachineChecks");
  }
  for (const c of m.drizzleMachineChecks) {
    if (typeof c.id !== "string" || !ID_PATTERN.test(c.id)) {
      throw new Error(`PIN_SCHEMA_CONTRACT drizzleMachineChecks id ${c.id}`);
    }
    if (typeof c.regex !== "string" || c.regex.length < 1) {
      throw new Error("PIN_SCHEMA_CONTRACT drizzleMachineChecks regex");
    }
    if (!ALLOWED_FLAGS.has(c.flags)) {
      throw new Error(`PIN_SCHEMA_CONTRACT drizzleMachineChecks flags ${JSON.stringify(c.flags)}`);
    }
  }
});
