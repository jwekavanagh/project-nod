/**
 * Single normative map from Quick Verify rollup verdict to funnel terminal_status (SSOT).
 */
export function quickVerifyVerdictToTerminalStatus(
  verdict: "pass" | "fail" | "uncertain",
): "complete" | "inconsistent" | "incomplete" {
  if (verdict === "pass") return "complete";
  if (verdict === "fail") return "inconsistent";
  return "incomplete";
}
