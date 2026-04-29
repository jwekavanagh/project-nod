import { and, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { apiKeys, apiKeysV2, users } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  type ActivationProblemInput,
  activationProblem,
} from "@/lib/activationHttp";
import { logFunnelEvent } from "@/lib/funnelEvent";
import {
  sha256HexApiKeyLookupFingerprint,
  verifyApiKey,
} from "@/lib/apiKeyCrypto";
import { isMissingApiKeyV2Relation } from "@/lib/isMissingApiKeyV2Relation";

export type ApiKeyScope = "read" | "meter" | "report" | "admin";
export type ApiKeySource = "v2" | "legacy";
export type ApiKeyStatus = "active" | "revoked" | "disabled" | "expired";

export type ApiKeyPrincipal = {
  source: ApiKeySource;
  userId: string;
  keyId: string;
  label: string;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  user: {
    plan: string;
    subscriptionStatus: string;
    stripePriceId: string | null;
  };
};

type ProblemCode =
  | "UNAUTHORIZED"
  | "INVALID_KEY"
  | "KEY_REVOKED"
  | "KEY_DISABLED"
  | "KEY_EXPIRED"
  | "INSUFFICIENT_SCOPE";

function authProblem(
  status: number,
  code: ProblemCode,
  detail: string,
  requiredScopes?: ApiKeyScope[],
): ActivationProblemInput {
  const body = {
    status,
    type: `${ACTIVATION_PROBLEM_BASE}/${code.toLowerCase().replace(/_/g, "-")}`,
    title: status === 403 ? "Forbidden" : "Unauthorized",
    detail,
    code,
  } satisfies ActivationProblemInput;
  if (!requiredScopes || requiredScopes.length === 0) return body;
  return {
    ...body,
    // `instance` is optional and string-typed; serialize required scopes there so
    // clients can inspect the required contract without changing base helper shape.
    instance: `required_scopes=${requiredScopes.join(",")}`,
  };
}

function parseBearer(req: NextRequest): { ok: true; rawKey: string } | { ok: false } {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false };
  const rawKey = auth.slice(7).trim();
  if (!rawKey) return { ok: false };
  return { ok: true, rawKey };
}

function scopesDedupe(scopes: ApiKeyScope[]): ApiKeyScope[] {
  return [...new Set(scopes)];
}

async function touchLastUsedNonBlocking(keyId: string): Promise<void> {
  if (typeof (db as unknown as { update?: unknown }).update !== "function") {
    return;
  }
  try {
    await db
      .update(apiKeysV2)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysV2.id, keyId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        kind: "api_key_last_used_write_failed",
        keyId,
        message,
      }),
    );
    await logFunnelEvent({
      event: "api_key_last_used_write_failed",
      metadata: {
        key_id: keyId,
        error: message,
      },
    });
  }
}

export async function authenticateApiKey(
  req: NextRequest,
): Promise<
  | { ok: true; principal: ApiKeyPrincipal }
  | { ok: false; response: ReturnType<typeof activationProblem> }
> {
  const parsed = parseBearer(req);
  if (!parsed.ok) {
    return {
      ok: false,
      response: activationProblem(
        req,
        authProblem(401, "UNAUTHORIZED", "Missing or invalid Authorization Bearer token."),
      ),
    };
  }

  const lookup = sha256HexApiKeyLookupFingerprint(parsed.rawKey);
  let keyRowsV2: Array<{ key: typeof apiKeysV2.$inferSelect; user: typeof users.$inferSelect }> = [];
  try {
    keyRowsV2 = await db
      .select({
        key: apiKeysV2,
        user: users,
      })
      .from(apiKeysV2)
      .innerJoin(users, eq(apiKeysV2.userId, users.id))
      .where(eq(apiKeysV2.keyLookupSha256, lookup))
      .limit(1);
  } catch (error) {
    if (!isMissingApiKeyV2Relation(error)) {
      throw error;
    }
  }

  const v2 = keyRowsV2[0];
  if (v2) {
    if (!verifyApiKey(parsed.rawKey, v2.key.keyHash)) {
      return {
        ok: false,
        response: activationProblem(req, authProblem(401, "INVALID_KEY", "Invalid API key.")),
      };
    }
    if (v2.key.status === "revoked") {
      return {
        ok: false,
        response: activationProblem(req, authProblem(401, "KEY_REVOKED", "API key is revoked.")),
      };
    }
    if (v2.key.status === "disabled") {
      return {
        ok: false,
        response: activationProblem(req, authProblem(401, "KEY_DISABLED", "API key is disabled.")),
      };
    }
    if (v2.key.expiresAt && v2.key.expiresAt.getTime() <= Date.now()) {
      return {
        ok: false,
        response: activationProblem(req, authProblem(401, "KEY_EXPIRED", "API key is expired.")),
      };
    }

    const effectiveScopes = scopesDedupe((v2.key.scopes ?? []) as ApiKeyScope[]);
    const scopes = effectiveScopes.length > 0
      ? effectiveScopes
      : (["read", "meter", "report", "admin"] as ApiKeyScope[]);

    void touchLastUsedNonBlocking(v2.key.id);

    return {
      ok: true,
      principal: {
        source: "v2",
        userId: v2.user.id,
        keyId: v2.key.id,
        label: v2.key.label,
        scopes,
        status: "active",
        user: {
          plan: v2.user.plan ?? "starter",
          subscriptionStatus: v2.user.subscriptionStatus ?? "none",
          stripePriceId: v2.user.stripePriceId ?? null,
        },
      },
    };
  }

  const legacyRows = await db
    .select({
      key: apiKeys,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyLookupSha256, lookup), isNull(apiKeys.revokedAt)))
    .limit(1);

  const legacy = legacyRows[0];
  if (!legacy) {
    return {
      ok: false,
      response: activationProblem(req, authProblem(401, "INVALID_KEY", "Unknown API key.")),
    };
  }
  if (!verifyApiKey(parsed.rawKey, legacy.key.keyHash)) {
    return {
      ok: false,
      response: activationProblem(req, authProblem(401, "INVALID_KEY", "Invalid API key.")),
    };
  }

  return {
    ok: true,
    principal: {
      source: "legacy",
      userId: legacy.user.id,
      keyId: legacy.key.id,
      label: "legacy",
      scopes: ["read", "meter", "report", "admin"],
      status: "active",
        user: {
          plan: legacy.user.plan,
          subscriptionStatus: legacy.user.subscriptionStatus,
          stripePriceId: legacy.user.stripePriceId,
        },
    },
  };
}

export function requireScopes(
  req: NextRequest,
  principal: ApiKeyPrincipal,
  requiredScopes: ApiKeyScope[],
): { ok: true } | { ok: false; response: ReturnType<typeof activationProblem> } {
  if (requiredScopes.every((scope) => principal.scopes.includes(scope))) {
    return { ok: true };
  }
  void logFunnelEvent({
    event: "api_key_scope_denied",
    userId: principal.userId,
    metadata: {
      key_id: principal.keyId,
      source: principal.source,
      required_scopes: requiredScopes,
      key_scopes: principal.scopes,
    },
  });
  return {
    ok: false,
    response: activationProblem(
      req,
      authProblem(
        403,
        "INSUFFICIENT_SCOPE",
        `This key does not include required scope(s): ${requiredScopes.join(", ")}`,
        requiredScopes,
      ),
    ),
  };
}
