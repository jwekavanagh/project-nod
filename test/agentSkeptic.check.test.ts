import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { AgentSkeptic } from "../src/sdk/AgentSkeptic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const partnerDir = join(__dirname, "../examples/partner-quickstart");

describe("AgentSkeptic.check", () => {
  it("without observations, matches replayFromFile for project layout", async () => {
    const layoutRoot = mkdtempSync(join(tmpdir(), "as-check-layout-"));
    const agentskepticDir = join(layoutRoot, "agentskeptic");
    mkdirSync(agentskepticDir, { recursive: true });
    writeFileSync(
      join(agentskepticDir, "tools.json"),
      readFileSync(join(partnerDir, "partner.tools.json"), "utf8"),
    );
    writeFileSync(
      join(agentskepticDir, "events.ndjson"),
      readFileSync(join(partnerDir, "partner.events.ndjson"), "utf8"),
    );
    const seedSql = readFileSync(join(partnerDir, "partner.seed.sql"), "utf8");
    const dbFile = join(tmpdir(), `as-check-${randomUUID()}.db`);
    const db = new DatabaseSync(dbFile);
    try {
      db.exec(seedSql);
    } finally {
      db.close();
    }
    const opts = {
      registryPath: join("agentskeptic", "tools.json"),
      databaseUrl: dbFile,
      projectRoot: layoutRoot,
      logStep: () => {},
      truthReport: () => {},
    };
    const skeptic = new AgentSkeptic(opts);
    const fromCheck = await skeptic.check({ workflowId: "wf_partner" });
    const fromReplay = await skeptic.replayFromFile({ workflowId: "wf_partner" });
    expect(fromCheck).toEqual(fromReplay);
    rmSync(layoutRoot, { recursive: true, force: true });
  });
});
