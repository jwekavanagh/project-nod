/**
 * OSS builds may print one stderr status line for product-activation telemetry
 * before verdict output or JSON error envelopes. Keep strings in sync with
 * `src/telemetry/telemetryStatusLine.ts`.
 */
import assert from "node:assert/strict";

export const OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_DISABLED = "Running offline: telemetry disabled.\n";
export const OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_ENABLED = "Telemetry enabled: sending anonymous usage events.\n";

/** `--no-human-report` verdict paths: stderr is empty or only the OSS telemetry status line. */
export function assertNoHumanReportStderrOptionalOssTelemetry(actual, label = "stderr") {
  assert.ok(
    actual === "" ||
      actual === OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_DISABLED ||
      actual === OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_ENABLED,
    `${label}: ${JSON.stringify(actual)}`,
  );
}

/**
 * Parse the CLI error envelope JSON from stderr when an optional telemetry line
 * may precede the JSON line (OSS only).
 */
export function parseExecutionTruthLayerJsonFromStderr(stderr) {
  const norm = stderr.replace(/\r\n/g, "\n").trimEnd();
  if (!norm) throw new Error("parseExecutionTruthLayerJsonFromStderr: empty stderr");
  const trimmed = norm.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(norm);
    } catch {
      // multi-line: fall through
    }
  }
  const lines = norm.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t.startsWith("{")) return JSON.parse(t);
  }
  throw new Error(`parseExecutionTruthLayerJsonFromStderr: no JSON object line in ${JSON.stringify(stderr)}`);
}
