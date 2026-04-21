import { POST, GET } from "@/app/api/demo/verify/route";
import {
  demoVerifySuccessResponseSchema,
  DEMO_SCENARIO_IDS,
} from "@/lib/demoVerify.contract";
import { runDemoVerifyScenario } from "@/lib/demoVerify";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const validateCert = loadSchemaValidator("outcome-certificate-v1");

function assertScenarioMatrix(scenarioId: string, c: Record<string, unknown>) {
  if (scenarioId === "wf_complete") {
    expect(c.stateRelation).toBe("matches_expectations");
    expect(c.highStakesReliance).toBe("permitted");
  }
  if (scenarioId === "wf_missing") {
    expect(c.stateRelation).toBe("does_not_match");
    expect(c.highStakesReliance).toBe("prohibited");
  }
  if (scenarioId === "wf_inconsistent") {
    expect(c.stateRelation).toBe("does_not_match");
    expect(c.highStakesReliance).toBe("prohibited");
  }
}

describe("POST /api/demo/verify", () => {
  for (const scenarioId of DEMO_SCENARIO_IDS) {
    it(`returns 200 and valid payload for ${scenarioId}`, async () => {
      const once = await runDemoVerifyScenario(scenarioId);
      const twice = await runDemoVerifyScenario(scenarioId);
      expect(once.certificate).toEqual(twice.certificate);
      expect(once.humanReport).toBe(twice.humanReport);

      const req = new NextRequest("http://localhost/api/demo/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      const parsed = demoVerifySuccessResponseSchema.safeParse(json);
      expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
      if (!parsed.success) return;

      expect(parsed.data.certificate).toEqual(once.certificate);
      expect(parsed.data.humanReport).toBe(once.humanReport);

      expect(validateCert(parsed.data.certificate)).toBe(true);
      assertScenarioMatrix(scenarioId, parsed.data.certificate as Record<string, unknown>);
    });
  }

  it("GET returns 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    const j = (await res.json()) as { ok: boolean; error: string };
    expect(j).toEqual({ ok: false, error: "DEMO_METHOD_NOT_ALLOWED" });
  });

  it("rejects non-JSON Content-Type with 415", async () => {
    const req = new NextRequest("http://localhost/api/demo/verify", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ scenarioId: "wf_complete" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("DEMO_UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects invalid JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/demo/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("DEMO_INVALID_JSON");
  });

  it("rejects {} with 400", async () => {
    const req = new NextRequest("http://localhost/api/demo/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("DEMO_VALIDATION_FAILED");
  });

  it("rejects unknown scenario with 400", async () => {
    const req = new NextRequest("http://localhost/api/demo/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "wf_nope" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("DEMO_VALIDATION_FAILED");
  });
});
