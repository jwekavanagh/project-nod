const MAX_BODY_BYTES = 393216;

export type ShareReportEnvelope =
  | {
      schemaVersion: 1;
      kind: "workflow";
      workflowResult: unknown;
      truthReportText: string;
    }
  | {
      schemaVersion: 1;
      kind: "quick";
      workflowDisplayId: string;
      quickReport: unknown;
      humanReportText: string;
    };

export type PostShareReportResult =
  | { ok: true; id: string; url: string }
  | { ok: false; status: number; bodySnippet: string };

/**
 * POST share envelope to {origin}/api/public/verification-reports (no auth v1).
 */
export async function postPublicVerificationReport(
  origin: string,
  envelope: ShareReportEnvelope,
  fetchImpl: typeof fetch = fetch,
): Promise<PostShareReportResult> {
  const base = origin.replace(/\/$/, "");
  const url = `${base}/api/public/verification-reports`;
  const body = JSON.stringify(envelope);
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, status: 413, bodySnippet: "payload_too_large" };
  }
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch {
    return { ok: false, status: 0, bodySnippet: "network_error" };
  }
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, bodySnippet: text.slice(0, 200) };
  }
  try {
    const json = JSON.parse(text) as { schemaVersion?: number; id?: string; url?: string };
    if (json.schemaVersion !== 1 || typeof json.id !== "string" || typeof json.url !== "string") {
      return { ok: false, status: res.status, bodySnippet: text.slice(0, 200) };
    }
    return { ok: true, id: json.id, url: json.url };
  } catch {
    return { ok: false, status: res.status, bodySnippet: text.slice(0, 200) };
  }
}
