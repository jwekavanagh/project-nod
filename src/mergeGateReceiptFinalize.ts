/**
 * Loaded dynamically from verification-truth.mjs after `npm run build` in merge gate prelude.
 */
import { cliErrorEnvelope, formatOperationalMessage } from "./failureCatalog.js";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { writeVerificationReceipt } from "./verificationReceipt.js";

export type MergeGatePhaseTimings = {
  regeneration: number;
  preflightDriftRoster: number;
  gitDiffGate: number;
  structuralGuards: number;
  postgresDistribution: number;
  journeyTail: number;
};

export function finalizeMergeGateReceipt(args: {
  packageRoot: string;
  timings: MergeGatePhaseTimings;
  exitCode: number;
  outcome: "success" | "failure" | "operational_abort";
  verificationTruthExitPhase: string | null;
}): void {
  const cwd = process.cwd();
  let outcome = args.outcome;
  let exitCode = args.exitCode;
  if (args.exitCode === 0 && outcome !== "success") {
    outcome = "success";
  }
  const r = writeVerificationReceipt({
    cwd,
    exitCode,
    inputIntegrity: {
      dbKind: "none",
      eventsSha256: null,
      npmTestScript: "verification:truth",
      registrySha256: null,
      verificationTruthExitPhase: args.verificationTruthExitPhase,
      workflowId: "merge_gate",
    },
    kind: "merge_gate",
    outcome,
    packageRoot: args.packageRoot,
    phaseTimingsMs: args.timings,
    verificationSummary: {
      enforceExitKind: null,
      operationalCode: null,
      workflowStatus: outcome === "success" ? "complete" : outcome === "failure" ? "inconsistent" : null,
    },
  });
  if (!r.ok) {
    console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.RECEIPT_PERSIST_FAILED, formatOperationalMessage(r.message)));
    process.exit(3);
  }
}
