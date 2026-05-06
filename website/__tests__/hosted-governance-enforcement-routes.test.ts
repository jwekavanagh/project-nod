import type { OutcomeCertificateV1 } from "agentskeptic";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authz = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  requireScopes: vi.fn(),
}));

vi.mock("@/lib/apiKeyAuthGateway", () => ({
  authenticateApiKey: authz.authenticateApiKey,
  requireScopes: authz.requireScopes,
}));

const fsm = vi.hoisted(() => ({
  executeFsmCreateBaseline: vi.fn(),
}));

vi.mock("@/lib/enforcementFsmPersistence", () => ({
  executeFsmCreateBaseline: fsm.executeFsmCreateBaseline,
}));

describe("hosted governance enforcement baselines (parser + hashes)", () => {
  const principal = {
    userId: "u_test",
    keyId: "k_test",
    source: "v2" as const,
    label: "t",
    scopes: ["meter"] as Array<"meter">,
    status: "active" as const,
    user: { plan: "team", subscriptionStatus: "active", stripePriceId: null as string | null },
  };

  beforeEach(() => {
    authz.authenticateApiKey.mockResolvedValue({ ok: true, principal });
    authz.requireScopes.mockReturnValue({ ok: true });
    fsm.executeFsmCreateBaseline.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /** Plan T2: substring must appear in RFC7807-style `detail`. */
  const EXPECTED_T2_DETAIL_SNIPPET = "failureSpine";

  it("T2-malformed-v3-schema", async () => {
    const badCert = structuredClone(hostedFixture.outcome_certificate) as Record<string, unknown>;
    delete badCert.failureSpine;
    const body = {
      schema_version: 3,
      run_id: "r-t2",
      workflow_id: hostedFixture.outcome_certificate.workflowId,
      material_truth_sha256: hostedFixture.material_truth_sha256,
      certificate_sha256: hostedFixture.certificate_sha256,
      outcome_certificate: badCert,
    };
    const { POST } = await import("@/app/api/v1/enforcement/baselines/route");
    const res = await POST(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: "Bearer k", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string; detail?: string };
    expect(j.code).toBe("BAD_REQUEST");
    expect(String(j.detail)).toContain(EXPECTED_T2_DETAIL_SNIPPET);
    expect(fsm.executeFsmCreateBaseline).not.toHaveBeenCalled();
  });

  it("T3-inner-cert-v2-rejected", async () => {
    const oc = structuredClone(hostedFixture.outcome_certificate) as Record<string, unknown>;
    oc.schemaVersion = 2;
    const body = {
      schema_version: 3,
      run_id: "r-t3",
      workflow_id: "wf-v2-inner",
      material_truth_sha256: "a".repeat(64),
      certificate_sha256: "b".repeat(64),
      outcome_certificate: oc,
    };
    const { POST } = await import("@/app/api/v1/enforcement/baselines/route");
    const res = await POST(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: "Bearer k", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { message?: string };
    expect(String(j.message)).toContain("outcome_certificate_v2_unsupported");
    expect(fsm.executeFsmCreateBaseline).not.toHaveBeenCalled();
  });

  it("T4-client-hash-mismatch", async () => {
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    const body = {
      schema_version: 3 as const,
      run_id: "r-t4",
      workflow_id: cert.workflowId,
      material_truth_sha256: hostedFixture.material_truth_sha256,
      certificate_sha256: "f".repeat(64),
      outcome_certificate: cert,
    };
    const { POST } = await import("@/app/api/v1/enforcement/baselines/route");
    const res = await POST(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: "Bearer k", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { message?: string };
    expect(j.message).toBe("Evidence hash mismatch for certificate or material truth.");
    expect(fsm.executeFsmCreateBaseline).not.toHaveBeenCalled();
  });
});
