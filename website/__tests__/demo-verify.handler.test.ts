import { POST, GET } from "@/app/api/demo/verify/route";
import { POST as verifyPost } from "@/app/api/verify/route";
import {
  demoVerifySuccessResponseSchema,
  DEMO_SCENARIO_IDS,
} from "@/lib/demoVerify.contract";
import { EXAMPLE_WF_MISSING_NDJSON } from "@/lib/verifyDefaultSample";
import { runDemoVerifyScenario } from "@/lib/demoVerify";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const validateCert = loadSchemaValidator("outcome-certificate-v1");

function assertScenarioMatrix(scenarioId: string, c: Record<string, unknown>) {
  const matrix: Record<string, { stateRelation: string; highStakesReliance: string }> = {
    wf_complete: { stateRelation: "matches_expectations", highStakesReliance: "permitted" },
    wf_missing: { stateRelation: "does_not_match", highStakesReliance: "prohibited" },
    wf_partial: { stateRelation: "does_not_match", highStakesReliance: "prohibited" },
    wf_inconsistent: { stateRelation: "does_not_match", highStakesReliance: "prohibited" },
    wf_duplicate_rows: { stateRelation: "does_not_match", highStakesReliance: "prohibited" },
    wf_unknown_tool: { stateRelation: "not_established", highStakesReliance: "prohibited" },
    wf_dup_seq: { stateRelation: "matches_expectations", highStakesReliance: "permitted" },
    wf_divergent_retry: { stateRelation: "not_established", highStakesReliance: "prohibited" },
  };
  const expected = matrix[scenarioId];
  if (!expected) {
    throw new Error(`unhandled scenario in matrix: ${scenarioId}`);
  }
  expect(c.stateRelation).toBe(expected.stateRelation);
  expect(c.highStakesReliance).toBe(expected.highStakesReliance);
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
      expect(parsed.data.workflowId).toBe(scenarioId);

      expect(validateCert(parsed.data.certificate)).toBe(true);
      assertScenarioMatrix(scenarioId, parsed.data.certificate as Record<string, unknown>);
    });
  }

  it("matches the same success keys as POST /api/verify", async () => {
    const demoRes = await POST(
      new NextRequest("http://localhost/api/demo/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: "wf_missing" }),
      }),
    );
    const verifyRes = await verifyPost(
      new NextRequest("http://localhost/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventsNdjson: EXAMPLE_WF_MISSING_NDJSON }),
      }),
    );
    expect(demoRes.status).toBe(200);
    expect(verifyRes.status).toBe(200);
    const demoJson = (await demoRes.json()) as Record<string, unknown>;
    const verifyJson = (await verifyRes.json()) as Record<string, unknown>;
    expect(Object.keys(demoJson).sort()).toEqual(Object.keys(verifyJson).sort());
  });

  it("GET returns 405 with x-request-id", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/demo/verify", { headers: { "x-vercel-id": "vercel-get-1" } }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("x-request-id")).toBe("vercel-get-1");
    const j = (await res.json()) as { ok: boolean; error: string };
    expect(j).toEqual({ ok: false, error: "DEMO_METHOD_NOT_ALLOWED" });
  });

  it("sets x-request-id on 200 and echoes x-vercel-id when present", async () => {
    const req = new NextRequest("http://localhost/api/demo/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-id": "vercel-post-xyz",
      },
      body: JSON.stringify({ scenarioId: "wf_complete" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("vercel-post-xyz");
  });

  it("sets x-request-id on 400", async () => {
    const req = new NextRequest("http://localhost/api/demo/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBeTruthy();
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
