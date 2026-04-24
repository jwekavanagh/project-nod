/**
 * Client-only: POST public verification report v2 for a demo outcome certificate
 * and open the saved report URL, or copy the v2 JSON envelope to the clipboard when the API is off (503).
 */
export function buildPublicReportV2Payload(certificate: unknown): { schemaVersion: 2; certificate: unknown; createdFrom: "website-demo" } {
  return { schemaVersion: 2, certificate, createdFrom: "website-demo" };
}

export function buildPublicReportV2ClipboardString(certificate: unknown): string {
  return JSON.stringify(buildPublicReportV2Payload(certificate), null, 2);
}

export type ShareDemoOutcomeResult =
  | { kind: "opened"; url: string }
  | { kind: "clipboard_off" }
  | { kind: "clipboard_failed" }
  | { kind: "invalid_response" };

/**
 * @param openWindow - defaults to `window.open` in browser; inject in tests
 * @param writeClipboard - defaults to `navigator.clipboard.writeText`
 */
export async function shareDemoOutcomeCertificate(
  certificate: unknown,
  deps?: {
    openWindow?: (url: string) => void;
    writeClipboard?: (text: string) => Promise<void>;
  },
): Promise<ShareDemoOutcomeResult> {
  const openWindow = deps?.openWindow ?? ((url: string) => window.open(url, "_blank", "noopener"));
  const writeClipboard = deps?.writeClipboard ?? ((text: string) => navigator.clipboard.writeText(text));

  const res = await fetch("/api/public/verification-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPublicReportV2Payload(certificate)),
  });

  if (res.status === 201) {
    const data = (await res.json()) as { schemaVersion: number; id: string; url: string };
    if (data.schemaVersion !== 2 || typeof data.url !== "string") {
      return { kind: "invalid_response" };
    }
    openWindow(data.url);
    return { kind: "opened", url: data.url };
  }

  if (res.status === 503) {
    try {
      await writeClipboard(buildPublicReportV2ClipboardString(certificate));
      return { kind: "clipboard_off" };
    } catch {
      return { kind: "clipboard_failed" };
    }
  }

  return { kind: "invalid_response" };
}
