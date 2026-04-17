import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callOpenAiMock = vi.hoisted(() => vi.fn());
const reserveSlotMock = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));

vi.mock("@/lib/registryDraft/callOpenAiRegistryDraft", () => ({
  callOpenAiRegistryDraftJson: (...args: unknown[]) => callOpenAiMock(...args),
}));

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

const validModelEnvelope = {
  schemaVersion: 1,
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
  model: { provider: "openai" as const, model: "gpt-4o-mini" },
};

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
    callOpenAiMock.mockReset();
    reserveSlotMock.mockReset();
    reserveSlotMock.mockResolvedValue({ ok: true });
    callOpenAiMock.mockResolvedValue({
      ok: true,
      contentText: JSON.stringify(validModelEnvelope),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("route does not import the verification engine or quick-verify modules", () => {
    const src = readFileSync(routeSrcPath, "utf8");
    expect(src).not.toContain("@/quickVerify");
    expect(src).not.toContain("runQuickVerify");
    expect(src).not.toContain("verifyWorkflow");
  });

  it("returns 404 when feature flag is off", async () => {
    vi.stubEnv("REGISTRY_DRAFT_ENABLED", "0");
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(404);
    expect(callOpenAiMock).not.toHaveBeenCalled();
  });

  it("returns 404 when OpenAI key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(404);
  });

  it("returns 403 without same-origin Origin or Referer", async () => {
    const res = await POST(jsonPost(branchBFixture, false));
    expect(res.status).toBe(403);
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
    expect(callOpenAiMock).not.toHaveBeenCalled();
  });

  it("returns 502 when model JSON fails response schema", async () => {
    callOpenAiMock.mockResolvedValueOnce({ ok: true, contentText: JSON.stringify({ not: "valid" }) });
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(502);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("MODEL_OUTPUT_INVALID");
  });

  it("returns 200 and reserves IP slot on happy path", async () => {
    const res = await POST(jsonPost(branchBFixture, true));
    expect(res.status).toBe(200);
    const j = (await res.json()) as typeof validModelEnvelope;
    expect(j.schemaVersion).toBe(1);
    expect(j.draft.tools[0]!.toolId).toBe("crm.upsert_contact");
    expect(reserveSlotMock).toHaveBeenCalled();
    expect(callOpenAiMock).toHaveBeenCalledTimes(1);
  });
});
