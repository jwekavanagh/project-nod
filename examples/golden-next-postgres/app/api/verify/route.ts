import { AgentSkeptic } from "agentskeptic";
import { createNextRouteHandler } from "agentskeptic/next";
import { join } from "node:path";

const skeptic = new AgentSkeptic({
  registryPath: join(process.cwd(), "agentskeptic", "tools.json"),
  databaseUrl: process.env.DATABASE_URL ?? "",
});

export const POST = createNextRouteHandler(skeptic, async (gate, req) => {
  const body = (await req.json()) as { events?: unknown[] };
  for (const ev of body.events ?? []) gate.appendRunEvent(ev);
  return await gate.evaluateCertificate();
});
