"use client";

import { CertificateRemediationPanel } from "@/components/verify/CertificateRemediationPanel";
import { EXAMPLE_WF_MISSING_NDJSON } from "@/lib/verifyDefaultSample";
import {
  verifyBundledSuccessResponseClientSchema,
  VERIFY_BUNDLED_ERROR_CODES,
} from "@/lib/verifyBundled.contract";
import { useMemo, useState } from "react";

type VerifyResult =
  | { ok: true; humanReport: string; certificate: unknown; workflowId: string }
  | { ok: false; title: string; body: string; requestId?: string };

function errorCopy(code: string): { title: string; body: string } {
  if (code === VERIFY_BUNDLED_ERROR_CODES.FIXTURES_MISSING) {
    return {
      title: "Demo fixtures unavailable",
      body: "The bundled fixtures are missing in this deployment. Please retry shortly.",
    };
  }
  if (code === VERIFY_BUNDLED_ERROR_CODES.UNAVAILABLE) {
    return {
      title: "Verification temporarily unavailable",
      body: "This endpoint is temporarily unavailable. Please try again in a minute.",
    };
  }
  if (code === VERIFY_BUNDLED_ERROR_CODES.VALIDATION_FAILED) {
    return {
      title: "Input failed validation",
      body: "Paste valid NDJSON tool events and try again.",
    };
  }
  return {
    title: "Verification failed",
    body: "The verifier could not complete this run. Please check your input and retry.",
  };
}

export function VerifyPageClient() {
  const [eventsNdjson, setEventsNdjson] = useState<string>(EXAMPLE_WF_MISSING_NDJSON);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  const parsedSuccess = useMemo(() => {
    if (!result || !result.ok) return null;
    return verifyBundledSuccessResponseClientSchema.safeParse({
      ok: true as const,
      workflowId: result.workflowId,
      certificate: result.certificate,
      humanReport: result.humanReport,
    });
  }, [result]);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventsNdjson }),
      });
      const requestId = res.headers.get("x-request-id") ?? undefined;
      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        setResult({
          ok: false,
          title: "Unexpected response",
          body: "The server returned a non-JSON response.",
          requestId,
        });
        return;
      }
      if (!res.ok) {
        const code = typeof json.error === "string" ? json.error : "";
        const copy = errorCopy(code);
        setResult({ ok: false, ...copy, requestId });
        return;
      }
      const parsed = verifyBundledSuccessResponseClientSchema.safeParse(json);
      if (!parsed.success) {
        setResult({
          ok: false,
          title: "Unexpected success response",
          body: "The response shape did not match the verification contract.",
          requestId,
        });
        return;
      }
      setResult({
        ok: true,
        workflowId: parsed.data.workflowId,
        certificate: parsed.data.certificate,
        humanReport: parsed.data.humanReport,
      });
    } catch {
      setResult({
        ok: false,
        title: "Network error",
        body: "Could not reach /api/verify. Check connectivity and retry.",
      });
    } finally {
      setLoading(false);
    }
  }

  const eventsFieldId = "verify-events-ndjson";

  return (
    <section id="verify-runner" className="home-section home-try-it" data-testid="verify-page-runner">
      <h1>Paste verification</h1>
      <p className="verify-page-lede verify-page-lede--lead">
        Paste an agent event log below. AgentSkeptic checks whether a claimed downstream change is actually reflected
        in verified state.
      </p>
      <p className="verify-page-lede verify-page-lede--follow">
        This bundled sample intentionally fails because a claimed CRM upsert cannot be proven against the mocked store.
      </p>

      <div className="verify-page-input-block">
        <label className="verify-page-events-label" htmlFor={eventsFieldId}>
          Paste NDJSON event log
        </label>
        <p className="muted verify-page-events-hint" id={`${eventsFieldId}-hint`}>
          Use one JSON event per line. The default sample intentionally fails.
        </p>
        <p className="verify-page-sample-kicker" id={`${eventsFieldId}-sample`}>
          Sample event
        </p>
        <textarea
          id={eventsFieldId}
          className="try-it-select verify-page-events-textarea"
          aria-label="Paste NDJSON event log"
          aria-describedby={`${eventsFieldId}-hint ${eventsFieldId}-sample`}
          rows={7}
          value={eventsNdjson}
          onChange={(e) => setEventsNdjson(e.target.value)}
        />
      </div>
      <p className="home-cta-row">
        <button type="button" className="btn" disabled={loading} onClick={run}>
          {loading ? "Running..." : "Run verification"}
        </button>
      </p>

      {result && !result.ok && (
        <div role="alert" className="try-it-output">
          <p className="error-text">
            <strong>{result.title}</strong>
          </p>
          <p className="error-text">{result.body}</p>
          {result.requestId ? (
            <p className="muted">
              Request ID: <code>{result.requestId}</code>
            </p>
          ) : null}
        </div>
      )}

      {result && result.ok && parsedSuccess?.success && (
        <div className="try-it-output" data-testid="verify-page-result">
          <CertificateRemediationPanel certificate={parsedSuccess.data.certificate} presentation="verify-demo" />
          <section className="verify-page-developer-evidence" aria-labelledby="verify-developer-evidence-heading">
            <h2 id="verify-developer-evidence-heading" className="verify-page-evidence-heading">
              Developer evidence
            </h2>
            <p className="muted verify-page-evidence-intro">
              Open these when you need the full verifier narrative or raw Outcome Certificate JSON.
            </p>
            {parsedSuccess.data.certificate.evidenceCompleteness.nextActions[0]?.text ? (
              <p className="muted verify-page-verifier-guidance" data-testid="remediation-primary-action">
                {parsedSuccess.data.certificate.evidenceCompleteness.nextActions[0]?.text}
              </p>
            ) : null}
            <details className="try-it-human-details">
              <summary>Full human report</summary>
              <pre className="code-block">{result.humanReport}</pre>
            </details>
            <details className="try-it-json-details">
              <summary>Raw outcome JSON</summary>
              <pre className="code-block">{JSON.stringify(result.certificate, null, 2)}</pre>
            </details>
          </section>
        </div>
      )}
    </section>
  );
}
