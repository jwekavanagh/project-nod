import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { normalizeSpkiPemForSidecar } from "./workflowResultSignature.js";
import { loadCorpusRun, resolveCorpusRootReal } from "./debugCorpus.js";
import { createDecisionGate } from "./decisionGate.js";
import { writeRunBundleFromDecisionGate } from "./agentRunBundle.js";
import { verifyRunBundleSignature } from "./verifyRunBundleSignature.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");

describe("DecisionGate run bundle write", () => {
  let workDir: string;
  let dbPath: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "etl-dg-persist-"));
    dbPath = join(workDir, "demo.db");
    const sql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
    const db = new DatabaseSync(dbPath);
    db.exec(sql);
    db.close();
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("writes a bundle that loadCorpusRun loads as ok with one verified step", async () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
    const wfId = "wf_complete";
    const lines = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    const events = lines.map((l) => JSON.parse(l) as { workflowId?: string }).filter((e) => e.workflowId === wfId);

    const bundleParent = mkdtempSync(join(tmpdir(), "etl-persist-out-"));
    const runId = "hook_run";
    const outDir = join(bundleParent, runId);
    try {
      const gate = createDecisionGate({
        workflowId: wfId,
        registryPath,
        databaseUrl: dbPath,
        projectRoot: root,
        truthReport: () => {},
      });
      for (const ev of events) {
        gate.appendRunEvent(ev);
      }
      const result = await gate.evaluate();
      expect(result.steps.length).toBe(1);
      expect(result.steps[0]!.status).toBe("verified");

      writeRunBundleFromDecisionGate({
        outDir,
        eventsNdjson: gate.toNdjsonUtf8(),
        workflowResult: result,
      });

      const loaded = loadCorpusRun(resolveCorpusRootReal(bundleParent), runId);
      expect(loaded.loadStatus).toBe("ok");

      const written = readFileSync(join(outDir, "events.ndjson"), "utf8").trim().split(/\r?\n/);
      expect(written.length).toBe(1);
      expect(JSON.parse(written[0]!)).toEqual(events[0]);
    } finally {
      rmSync(bundleParent, { recursive: true, force: true });
    }
  });

  it("ed25519PrivateKeyPemPath writes v2 bundle verifiable by verifyRunBundleSignature", async () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
    const wfId = "wf_complete";
    const lines = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    const events = lines.map((l) => JSON.parse(l) as { workflowId?: string }).filter((e) => e.workflowId === wfId);

    const bundleParent = mkdtempSync(join(tmpdir(), "etl-persist-sign-"));
    const runId = "hook_signed";
    const outDir = join(bundleParent, runId);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    const keyPath = join(bundleParent, "private.pem");
    const pubPath = join(bundleParent, "public.pem");
    writeFileSync(keyPath, privatePem, "utf8");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    try {
      const gate = createDecisionGate({
        workflowId: wfId,
        registryPath,
        databaseUrl: dbPath,
        projectRoot: root,
        truthReport: () => {},
      });
      for (const ev of events) {
        gate.appendRunEvent(ev);
      }
      const result = await gate.evaluate();
      writeRunBundleFromDecisionGate({
        outDir,
        eventsNdjson: gate.toNdjsonUtf8(),
        workflowResult: result,
        ed25519PrivateKeyPemPath: keyPath,
      });

      const loaded = loadCorpusRun(resolveCorpusRootReal(bundleParent), runId);
      expect(loaded.loadStatus).toBe("ok");
      if (loaded.loadStatus !== "ok") return;
      expect(loaded.agentRunRecord.schemaVersion).toBe(2);
      if (loaded.agentRunRecord.schemaVersion !== 2) return;
      expect(loaded.agentRunRecord.artifacts.workflowResultSignature.relativePath).toBe(
        "workflow-result.sig.json",
      );

      const vr = verifyRunBundleSignature(outDir, pubPath);
      expect(vr).toEqual({ ok: true });
    } finally {
      rmSync(bundleParent, { recursive: true, force: true });
    }
  });
});
