import { NextRequest } from "next/server";
import { activationJson, activationReserveDeny } from "@/lib/activationHttp";
import { authenticateApiKey, requireScopes } from "@/lib/apiKeyAuthGateway";
import { listEnforcementHistory, listGovernanceAcceptances } from "@/lib/enforcementState";

export async function GET(req: NextRequest) {
  const authn = await authenticateApiKey(req);
  if (!authn.ok) return authn.response;
  const scope = requireScopes(req, authn.principal, ["meter"]);
  if (!scope.ok) return scope.response;

  const workflowId = req.nextUrl.searchParams.get("workflow_id")?.trim() ?? "";
  if (!workflowId) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Missing workflow_id query parameter.",
    });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
  const limit = parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  const [events, acceptances] = await Promise.all([
    listEnforcementHistory({
      userId: authn.principal.userId,
      workflowId,
      limit: limit === undefined ? undefined : Math.trunc(limit),
    }),
    listGovernanceAcceptances({
      userId: authn.principal.userId,
      workflowId,
      limit: limit === undefined ? undefined : Math.trunc(limit),
    }),
  ]);
  return activationJson(req, { schema_version: 1, workflow_id: workflowId, events, acceptances }, 200);
}

