/**
 * By-construction R1: ineligible certificate module must not reference DB / verify pipeline.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = readFileSync(
  join(root, "src", "langGraphCheckpointTrustIneligibleCertificate.ts"),
  "utf8",
);

const FORBIDDEN = [
  "pipeline",
  "verifyRunStateFromBufferedRunEvents",
  "verifyRunStateFromEvents",
  "sqlReadBackend",
  "reconciler",
  "node:sqlite",
  "connectPostgres",
  "DatabaseSync",
];

describe("langGraphCheckpointTrustIneligibleCertificate import guard", () => {
  it("source contains no forbidden substrings", () => {
    for (const s of FORBIDDEN) {
      assert.equal(
        src.includes(s),
        false,
        `langGraphCheckpointTrustIneligibleCertificate.ts must not contain "${s}"`,
      );
    }
  });
});
