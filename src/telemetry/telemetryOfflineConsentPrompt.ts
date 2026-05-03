import { createInterface } from "node:readline";
import { LICENSE_PREFLIGHT_ENABLED } from "../generated/commercialBuildFlags.js";
import {
  hasPersistedTelemetryPreference,
  isProductActivationTelemetryEnabled,
  tryPersistTelemetryPreference,
} from "./telemetryConsent.js";

const PROMPT_TEXT =
  "Verification complete. AgentSkeptic ran offline.\n" +
  "\n" +
  "Help improve AgentSkeptic by sending anonymous usage telemetry?\n" +
  "No workflow data, database contents, credentials, prompts, traces, or verification artifacts are sent.\n" +
  "You can change this later with AGENTSKEPTIC_TELEMETRY=1 or AGENTSKEPTIC_TELEMETRY=0.\n" +
  "\n" +
  "Enable telemetry? (y/N): ";

export type TelemetryConsentPromptDeps = {
  /** Test hook: return simulated stdin line (no trailing newline required). */
  readAnswerLine?: () => Promise<string>;
};

/**
 * After first successful local-sqlite-only OSS verify, optionally prompt once to persist telemetry opt-in/out.
 * Never throws; failures leave telemetry unchanged (disabled unless already opted in).
 */
export async function maybePromptTelemetryAfterFirstOfflineSuccess(
  input: {
    verificationUsedOnlyLocalSqliteFile: boolean;
    shareReportOriginUsed: boolean;
    /** Certificate exit would be success (matches_expectations). */
    verifySucceeded: boolean;
  },
  deps: TelemetryConsentPromptDeps = {},
): Promise<void> {
  if (LICENSE_PREFLIGHT_ENABLED) return;
  if (!input.verifySucceeded) return;
  if (!input.verificationUsedOnlyLocalSqliteFile) return;
  if (input.shareReportOriginUsed) return;

  if (process.env.AGENTSKEPTIC_TELEMETRY !== undefined) return;

  if (hasPersistedTelemetryPreference()) return;
  if (isProductActivationTelemetryEnabled()) return;

  if (String(process.env.CI).toLowerCase() === "true") return;
  if (!process.stdin.isTTY || !process.stderr.isTTY) return;

  process.stderr.write(PROMPT_TEXT);

  let line: string;
  try {
    if (deps.readAnswerLine !== undefined) {
      line = await deps.readAnswerLine();
    } else {
      line = await readLineFromStdin();
    }
  } catch {
    return;
  }

  const normalized = line.trim().toLowerCase();
  const yes = normalized === "y" || normalized === "yes";
  tryPersistTelemetryPreference(yes);
}

async function readLineFromStdin(): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.once("line", (ln) => {
      rl.close();
      resolve(ln ?? "");
    });
    rl.once("error", (err) => {
      try {
        rl.close();
      } catch {
        /* ignore */
      }
      reject(err);
    });
  });
}
