import { existsSync } from "node:fs";
import path from "node:path";
import { createDecisionGate } from "./decisionGate.js";
import { loadEventsForWorkflow } from "./loadEvents.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";

const PROJECT_LAYOUT_MISSING = "PROJECT_VERIFICATION_LAYOUT_MISSING" as const;

/**
 * Thin file-replay alias: reads `agentskeptic/events.ndjson` into a DecisionGate buffer and returns the same Outcome Certificate as batch verify.
 * Prefer `createDecisionGate` for runtime integration.
 */
export async function verifyAgentskeptic(options: {
  workflowId: string;
  databaseUrl: string;
  projectRoot?: string;
}): Promise<OutcomeCertificateV1> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const resolvedRoot = path.resolve(projectRoot);
  const agentskepticDir = path.join(resolvedRoot, "agentskeptic");
  const eventsPath = path.join(agentskepticDir, "events.ndjson");
  const registryPathRel = path.join("agentskeptic", "tools.json");

  if (!existsSync(eventsPath) || !existsSync(path.join(resolvedRoot, registryPathRel))) {
    throw new TruthLayerError(
      PROJECT_LAYOUT_MISSING,
      `${eventsPath}, ${path.join(resolvedRoot, registryPathRel)}`,
    );
  }

  const load = loadEventsForWorkflow(eventsPath, options.workflowId);
  const gate = createDecisionGate({
    workflowId: options.workflowId,
    registryPath: registryPathRel,
    databaseUrl: options.databaseUrl,
    projectRoot: resolvedRoot,
    logStep: () => {},
    truthReport: () => {},
  });
  for (const ev of load.runEvents) {
    gate.appendRunEvent(ev);
  }
  return gate.evaluateCertificate();
}
