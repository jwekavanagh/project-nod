import { GET, POST } from "@/app/api/verify/route";
import { EXAMPLE_WF_MISSING_NDJSON } from "@/lib/verifyDefaultSample";
import {
  verifyBundledSuccessResponseSchema,
  VERIFY_BUNDLED_ERROR_CODES,
} from "@/lib/verifyBundled.contract";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

const validateCert = loadSchemaValidator("outcome-certificate-v1");

describe("POST /api/verify", () => {
  it("returns contradiction for default paste sample", async () => {
    const req = new NextRequest("http://localhost/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventsNdjson: EXAMPLE_WF_MISSING_NDJSON }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const parsed = verifyBundledSuccessResponseSchema.safeParse(json);
    expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.workflowId).toBe("wf_missing");
    expect(validateCert(parsed.data.certificate)).toBe(true);
    const cert = parsed.data.certificate as { stateRelation?: string };
    expect(cert.stateRelation).toBe("does_not_match");
    expect(parsed.data.humanReport.toLowerCase()).toContain("missing");
    expect(parsed.data.humanReport.toLowerCase()).toContain("row");
  });

  it("returns matching verdict for edited c_ok record id", async () => {
    const passing =
      '{"schemaVersion":1,"workflowId":"wf_missing","seq":0,"type":"tool_observed","toolId":"crm.upsert_contact","params":{"recordId":"c_ok","fields":{"name":"Alice","status":"active"}}}\n';
    const req = new NextRequest("http://localhost/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventsNdjson: passing }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const parsed = verifyBundledSuccessResponseSchema.safeParse(json);
    expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
    if (!parsed.success) return;
    const cert = parsed.data.certificate as { stateRelation?: string };
    expect(cert.stateRelation).toBe("matches_expectations");
  });

  it("rejects invalid request with 400", async () => {
    const req = new NextRequest("http://localhost/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe(VERIFY_BUNDLED_ERROR_CODES.VALIDATION_FAILED);
  });

  it("rejects non-json content type with 415", async () => {
    const req = new NextRequest("http://localhost/api/verify", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe(VERIFY_BUNDLED_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
  });

  it("GET returns 405 with x-request-id", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/verify", { headers: { "x-vercel-id": "verify-get-1" } }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("x-request-id")).toBe("verify-get-1");
    const j = (await res.json()) as { ok: boolean; error: string };
    expect(j).toEqual({ ok: false, error: VERIFY_BUNDLED_ERROR_CODES.METHOD_NOT_ALLOWED });
  });
});
