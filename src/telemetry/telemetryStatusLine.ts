import { LICENSE_PREFLIGHT_ENABLED } from "../generated/commercialBuildFlags.js";
import { isProductActivationTelemetryEnabled } from "./telemetryConsent.js";

/** Exact stderr line when OSS telemetry is off (for tests / contract checks). */
export const OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_DISABLED = "Running offline: telemetry disabled.\n";

/** Exact stderr line when OSS telemetry is on (for tests / contract checks). */
export const OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_ENABLED = "Telemetry enabled: sending anonymous usage events.\n";

let printed = false;

/** Vitest / node:test: allow repeated CLI runs in one process. */
export function resetTelemetryStatusLineForTests(): void {
  printed = false;
}

/**
 * OSS build: print once whether product-activation telemetry is enabled (stderr).
 * Does not claim all network is disabled (witnesses, share-report, licensing may still apply).
 */
export function printProductActivationTelemetryStatusLineOnce(): void {
  if (printed) return;
  if (LICENSE_PREFLIGHT_ENABLED) return;
  printed = true;
  if (isProductActivationTelemetryEnabled()) {
    process.stderr.write(OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_ENABLED);
  } else {
    process.stderr.write(OSS_PRODUCT_ACTIVATION_TELEMETRY_STDERR_DISABLED);
  }
}
