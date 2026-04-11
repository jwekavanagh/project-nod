import { POST, GET } from "@/app/api/demo/verify/route";
import {
  demoVerifySuccessResponseSchema,
  DEMO_SCENARIO_IDS,
} from "@/lib/demoVerify.contract";
import { runDemoVerifyScenario } from "@/lib/demoVerify";
import { loadSchemaValidator } from "agentskeptic";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const validateWr = loadSchemaValidator("workflow-result");

function assertScenarioMatrix(scenarioId: string, w: Record<string, unknown>) {
  const steps = w.steps as { status: string; reasons?: { code: string }[] }[];
  const truth = w.workflowTruthReport as { steps: { outcomeLabel: string }[] };
  if (scenarioId === "wf_complete") {
    expect(w.status).toBe("complete");
    expect(steps[0]?.status).toBe("verified");
    expect(steps[0]?.reasons?.length ?? 0).toBe(0);
    expect(truth.steps[0]?.outcomeLabel).toBe("VERIFIED");
  }
  if (scenarioId === "wf_missing") {
    expect(w.status).toBe("inconsistent");
    expect(steps[0]?.status).toBe("missing");
    expect(steps[0]?.reasons?.[0]?.code).toBe("ROW_ABSENT");
    expect(truth.steps[0]?.outcomeLabel).toBe("FAILED_ROW_MISSING");
  }
  if (scenarioId === "wf_inconsistent") {
    expect(w.status).toBe("inconsistent");
    expect(steps[0]?.status).toBe("inconsistent");
    expect(steps[0]?.reasons?.[0]?.code).toBe("VALUE_MISMATCH");
    expect(truth.steps[0]?.outcomeLabel).toBe("FAILED_VALUE_MISMATCH");
  }
}

describe("POST /api/demo/verify", () => {
  for (const scenarioId of DEMO_SCENARIO_IDS) {
    it(`returns 200 and valid payload for ${scenarioId}`, async () => {
      const once = await runDemoVerifyScenario(scenarioId);
      const twice = await runDemoVerifyScenario(scenarioId);
      expect(once.workflowResult).toEqual(twice.workflowResult);
      expect(once.truthReportText).toBe(twice.truthReportText);

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

      expect(parsed.data.workflowResult).toEqual(once.workflowResult);
      expect(parsed.data.truthReportText).toBe(once.truthReportText);

      expect(validateWr(parsed.data.workflowResult)).toBe(true);
      assertScenarioMatrix(scenarioId, parsed.data.workflowResult as Record<string, unknown>);
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
