import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  ACTIVATION_REQUEST_ID_HEADER,
  activationJson,
  activationProblem,
  activationProblemWithId,
  activationReserveDeny,
  isValidActivationRequestId,
  resolveActivationRequestId,
} from "@/lib/activationHttp";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reqWithHeader(id?: string): NextRequest {
  const h = new Headers();
  if (id !== undefined) h.set(ACTIVATION_REQUEST_ID_HEADER, id);
  return new NextRequest("http://127.0.0.1/api/test", { headers: h });
}

describe("activationHttp", () => {
  describe("isValidActivationRequestId", () => {
    it("accepts UUID v4", () => {
      expect(isValidActivationRequestId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });
    it("accepts 8+ char token", () => {
      expect(isValidActivationRequestId("vercel-abc")).toBe(true);
    });
    it("rejects too short token", () => {
      expect(isValidActivationRequestId("short")).toBe(false);
    });
    it("rejects empty and junk", () => {
      expect(isValidActivationRequestId("")).toBe(false);
      expect(isValidActivationRequestId("no spaces here")).toBe(false);
    });
  });

  describe("resolveActivationRequestId", () => {
    it("echoes valid client id", () => {
      const id = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
      expect(resolveActivationRequestId(reqWithHeader(id))).toBe(id);
    });
    it("generates when header missing", () => {
      const id = resolveActivationRequestId(reqWithHeader());
      expect(id).toMatch(UUID_RE);
    });
    it("generates when header invalid", () => {
      const id = resolveActivationRequestId(reqWithHeader("!!!"));
      expect(id).toMatch(UUID_RE);
    });
  });

  describe("activationProblem", () => {
    it("sets x-request-id and problem body", async () => {
      const res = activationProblem(reqWithHeader(), {
        status: 400,
        type: "https://agentskeptic.com/problems/bad-request",
        title: "Bad Request",
        detail: "Invalid JSON.",
        code: "BAD_REQUEST",
      });
      expect(res.headers.get(ACTIVATION_REQUEST_ID_HEADER)).toMatch(UUID_RE);
      const j = (await res.json()) as Record<string, unknown>;
      expect(j.type).toBe("https://agentskeptic.com/problems/bad-request");
      expect(j.title).toBe("Bad Request");
      expect(j.status).toBe(400);
      expect(j.detail).toBe("Invalid JSON.");
      expect(j.code).toBe("BAD_REQUEST");
    });

    it("echoes request x-request-id on problem response", async () => {
      const rid = "client-token-12345678";
      const res = activationProblem(reqWithHeader(rid), {
        status: 429,
        type: "https://agentskeptic.com/problems/rate-limited",
        title: "Too Many Requests",
        detail: "Slow down.",
        code: "RATE_LIMITED",
      });
      expect(res.headers.get(ACTIVATION_REQUEST_ID_HEADER)).toBe(rid);
    });
  });

  describe("activationProblemWithId", () => {
    it("uses forced id", () => {
      const res = activationProblemWithId("stored-oss-id-123456", {
        status: 400,
        type: "https://agentskeptic.com/problems/x",
        title: "T",
        detail: "D",
      });
      expect(res.headers.get(ACTIVATION_REQUEST_ID_HEADER)).toBe("stored-oss-id-123456");
    });
  });

  describe("activationJson", () => {
    it("sets header on success json", () => {
      const res = activationJson(reqWithHeader(), { ok: true }, 200);
      expect(res.headers.get(ACTIVATION_REQUEST_ID_HEADER)).toBeTruthy();
    });
  });

  describe("activationReserveDeny", () => {
    it("includes legacy reserve fields and problem fields", async () => {
      const res = activationReserveDeny(reqWithHeader(), {
        status: 403,
        code: "QUOTA_EXCEEDED",
        message: "Cap hit",
        upgrade_url: "https://agentskeptic.com/pricing",
      });
      const j = (await res.json()) as Record<string, unknown>;
      expect(j.allowed).toBe(false);
      expect(j.code).toBe("QUOTA_EXCEEDED");
      expect(j.message).toBe("Cap hit");
      expect(j.upgrade_url).toBe("https://agentskeptic.com/pricing");
      expect(j.type).toContain("quota-exceeded");
      expect(j.title).toBe("License reservation denied");
      expect(j.status).toBe(403);
      expect(j.detail).toBe("Cap hit");
      expect(res.headers.get(ACTIVATION_REQUEST_ID_HEADER)).toBeTruthy();
    });
  });
});
