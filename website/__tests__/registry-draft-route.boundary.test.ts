import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBootstrapPackInputJson, synthesizeQuickInputUtf8FromOpenAiV1 } from "agentskeptic/bootstrapPackSynthesis";

const fetchMock = vi.hoisted(() => vi.fn());
const reserveSlotMock = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));

vi.mock("@/lib/ossClaimRateLimits", () => ({
  withSerializableRetry: async <T>(fn: () => Promise<T>) => fn(),
  reserveRegistryDraftIpSlot: (...args: unknown[]) => reserveSlotMock(...args),
}));

vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
  },
}));

import { POST } from "@/app/api/integrator/registry-draft/route";
import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const routeSrcPath = join(__dirname, "..", "src", "app", "api", "integrator", "registry-draft", "route.ts");
const branchBFixture = readFileSync(
  join(repoRoot, "test", "fixtures", "registry-draft", "branch-b-envelope.json"),
  "utf8",
);

/** LLM partial only; server merges v3 + readiness + quickIngestInput. */
const validLlmPartial = {
  draft: {
    tools: [
      {
        toolId: "crm.upsert_contact",
        effectDescriptionTemplate: "Upsert contact {/recordId} with fields {/fields}",
        verification: {
          kind: "sql_row" as const,
          table: { const: "contacts" },
          identityEq: [{ column: { const: "id" }, value: { pointer: "/recordId" } }],
          requiredFields: { pointer: "/fields" },
        },
      },
    ],
  },
  assumptions: [] as string[],
  warnings: [] as string[],
  disclaimer: "Draft only; review before use.",
  model: { model: "gpt-4o-mini" },
};

function mockOpenAiResponse(): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validLlmPartial) } }],
    }),
    { status: 200 },
  );
}

function jsonPost(body: string, includeFunnelOrigin: boolean): NextRequest {
  const h = new Headers({ "content-type": "application/json" });
  if (includeFunnelOrigin) {
    h.set("origin", getCanonicalSiteOrigin());
  }
  return new NextRequest("http://127.0.0.1:3000/api/integrator/registry-draft", {
    method: "POST",
    headers: h,
    body,
  });
}

describe("POST /api/integrator/registry-draft", () => {
  beforeEach(() => {
    vi.stubEnv("REGISTRY_DRAFT_ENABLED", "1");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("NODE_ENV", "test");
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(mockOpenAiResponse()));
    vi.stubGlobal("fetch", fetchMock);
    reserveSlotMock.mockReset();
    reserveSlotMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("route does not import quick-verify registry modules beyond DraftEngine facade", () => {
    const src = readFileSync(routeSrcPath, "utf8");
    expect(src).not.toContain("@/quickVerify");
    expect(src).not.toContain("runQuickVerify");
  });

  it("returns 404 when feature flag is off", async () => {
    vi.stubEnv("REGISTRY_DRAFT_ENABLED", "0");
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 CONFIG_MISSING when hosted_openai credentials are missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(503);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("CONFIG_MISSING");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 without same-origin Origin or Referer", async () => {
    const res = await POST(jsonPost(branchBFixture, false));
    expect(res.status).toBe(403);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("FUNNEL_ORIGIN_FORBIDDEN");
  });

  it("returns 400 for non-JSON content-type", async () => {
    const h = new Headers({ "content-type": "text/plain", origin: getCanonicalSiteOrigin() });
    const req = new NextRequest("http://127.0.0.1:3000/api/integrator/registry-draft", {
      method: "POST",
      headers: h,
      body: branchBFixture,
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 INVALID_REQUEST for malformed envelope", async () => {
    const res = await POST(jsonPost("{}", true));
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("INVALID_REQUEST");
  });

  it("returns 429 when hourly IP cap is exhausted", async () => {
    reserveSlotMock.mockResolvedValueOnce({ ok: false });
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 when model JSON fails response schema", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ not: "valid" }) } }] }),
        { status: 200 },
      ),
    );
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(502);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("MODEL_OUTPUT_INVALID");
  });

  it("returns 200 with v3 merged response, readiness, and deterministic quickIngestInput on happy path", async () => {
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      schemaVersion: number;
      draft: { tools: Array<{ toolId: string }> };
      quickIngestInput: { encoding: string; body: string };
      readiness?: { status: string };
      generation?: { backend: string; model: string };
    };
    expect(j.schemaVersion).toBe(3);
    expect(j.draft.tools[0]!.toolId).toBe("crm.upsert_contact");
    expect(j.quickIngestInput.encoding).toBe("utf8");
    expect(j.quickIngestInput.body.length).toBeGreaterThan(0);
    expect(j.readiness?.status).toBe("ready");
    expect(j.generation?.backend).toBe("hosted_openai");
    const golden = JSON.parse(
      readFileSync(join(repoRoot, "test", "fixtures", "registry-draft", "normalized-bootstrap-golden.json"), "utf8"),
    );
    const expected = synthesizeQuickInputUtf8FromOpenAiV1(
      parseBootstrapPackInputJson(JSON.stringify(golden)),
    );
    expect(j.quickIngestInput.body).toBe(expected);
    expect(reserveSlotMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });
});
