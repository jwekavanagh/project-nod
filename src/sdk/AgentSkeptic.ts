import { createDecisionGateImpl, type CreateDecisionGateOptions, type DecisionGate } from "../decisionGate.js";
import { verifyWorkflow as verifyWorkflowInner } from "../pipeline.js";
import {
  runQuickVerify as runQuickVerifyInner,
  type RunQuickVerifyOptions,
  type RunQuickVerifyResult,
} from "../quickVerify/runQuickVerify.js";
import { verifyAgentskepticImpl } from "../verifyAgentskeptic.js";
import { fetchCurrentUsage, type CurrentUsageResponse } from "../commercial/getCurrentUsage.js";
import {
  runLicensePreflightIfNeeded,
  type LicensePreflightIntent,
  type LicensePreflightResult,
} from "../commercial/licensePreflight.js";
import type { WorkflowResult } from "../types.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { CanonicalEventEmitter } from "./events/CanonicalEventEmitter.js";
import type { EventSink } from "./events/types.js";

export type AgentSkepticOptions = Omit<CreateDecisionGateOptions, "workflowId">;

/**
 * AgentSkeptic v2 SDK facade: one entry for gating, verify, quick verify, license preflight, and usage.
 */
export class AgentSkeptic {
  constructor(private readonly opts: AgentSkepticOptions) {}

  /** Build a decision gate for a single workflow id (buffers events then evaluates against DB + registry). */
  gate(
    workflowIdOrOpts:
      | string
      | (Pick<CreateDecisionGateOptions, "workflowId"> &
          Partial<Omit<CreateDecisionGateOptions, "workflowId" | "registryPath" | "databaseUrl">>),
  ): DecisionGate {
    if (typeof workflowIdOrOpts === "string") {
      return createDecisionGateImpl({ ...this.opts, workflowId: workflowIdOrOpts });
    }
    const { workflowId, ...rest } = workflowIdOrOpts;
    return createDecisionGateImpl({ ...this.opts, workflowId, ...rest });
  }

  /** Batch verify from events file + registry (same as `verifyWorkflow`). */
  async verify(options: Parameters<typeof verifyWorkflowInner>[0]): Promise<WorkflowResult> {
    return verifyWorkflowInner(options);
  }

  /** Replay `agentskeptic/events.ndjson` from the project layout (same as `verifyAgentskeptic`). */
  async replayFromFile(options: { workflowId: string; databaseUrl?: string; projectRoot?: string }): Promise<OutcomeCertificateV1> {
    return verifyAgentskepticImpl({
      workflowId: options.workflowId,
      databaseUrl: options.databaseUrl ?? this.opts.databaseUrl,
      projectRoot: options.projectRoot ?? this.opts.projectRoot,
    });
  }

  /** Quick verify (structured input + export registry). */
  async quick(opts: RunQuickVerifyOptions): Promise<RunQuickVerifyResult> {
    return runQuickVerifyInner(opts);
  }

  /** License reserve preflight when commercial build + API key (no-op in OSS). */
  async preflightLicense(
    intent: LicensePreflightIntent = "verify",
    opts?: { runId?: string; xRequestId?: string },
  ): Promise<LicensePreflightResult> {
    return runLicensePreflightIfNeeded(intent, opts);
  }

  /** Current-month usage for the authenticated API key (commercial only). */
  async currentUsage(): Promise<CurrentUsageResponse> {
    return fetchCurrentUsage();
  }

  /** Canonical event emitter for faithful event production. */
  createEmitter(options: {
    workflowId: string;
    sink: EventSink;
    defaultToolObservedSchemaVersion?: 1 | 2;
  }): CanonicalEventEmitter {
    return new CanonicalEventEmitter({
      workflowId: options.workflowId,
      sink: options.sink,
      defaultToolObservedSchemaVersion: options.defaultToolObservedSchemaVersion,
    });
  }
}
