import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(__dirname, "..");
const embeddedDir = join(websiteRoot, "src", "content", "embeddedReports");

describe("embeddedReports outcome certificates", () => {
  it("every embedded JSON with an outcome certificate uses schemaVersion 3 + failureSpine v1", () => {
    const paths = globSync("**/*.json", { cwd: embeddedDir }).sort();
    expect(paths.length).toBeGreaterThan(0);
    for (const rel of paths) {
      const raw = readFileSync(join(embeddedDir, rel), "utf8");
      const doc = JSON.parse(raw) as Record<string, unknown>;
      const cert = (doc.certificate ?? doc) as Record<string, unknown>;
      if (cert.workflowId === undefined || cert.schemaVersion === undefined) continue;
      expect(cert.schemaVersion, rel).toBe(3);
      const spine = cert.failureSpine as Record<string, unknown> | undefined;
      expect(spine?.schemaVersion, rel).toBe(1);
      expect(["safe", "unsafe", "unknown"]).toContain(spine?.trustDecision as string);
    }
  });
});
