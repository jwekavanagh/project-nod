"use client";

import { integrateRegistryDraft } from "@/content/productCopy";
import { useCallback, useMemo, useState } from "react";

type PanelResult =
  | null
  | { kind: "success"; lead: string; json: string }
  | { kind: "error"; text: string };

function draftJsonTextareaRows(json: string): number {
  const lines = json.split("\n").length;
  return Math.min(42, Math.max(14, lines + 2));
}

type RegistryDraftPanelProps = {
  /** When true, omit the page-level h2 so the parent can own the heading (e.g. a `<details>` summary on `/integrate`). */
  embedInIntegrateSecondary?: boolean;
};

export function RegistryDraftPanel({ embedInIntegrateSecondary = false }: RegistryDraftPanelProps) {
  const d = integrateRegistryDraft;
  const [body, setBody] = useState(d.exampleJson);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PanelResult>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const successJson = result?.kind === "success" ? result.json : null;
  const outputRows = useMemo(
    () => (successJson ? draftJsonTextareaRows(successJson) : 14),
    [successJson],
  );

  const copyDraftJson = useCallback(async () => {
    if (result?.kind !== "success") return;
    try {
      await navigator.clipboard.writeText(result.json);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      /* clipboard may be denied; ignore */
    }
  }, [result]);

  const submit = useCallback(async () => {
    setBusy(true);
    setResult(null);
    setCopyFeedback(false);
    try {
      const res = await fetch("/api/integrator/registry-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const text = await res.text();
      if (res.ok) {
        let json = text;
        try {
          json = JSON.stringify(JSON.parse(text) as unknown, null, 2);
        } catch {
          /* keep raw text if not JSON */
        }
        setResult({ kind: "success", lead: d.resultSuccessLead, json });
      } else {
        setResult({ kind: "error", text: `${res.status}\n${text}` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({
        kind: "error",
        text:
          msg === "Failed to fetch"
            ? `${msg}\n\nNo response from the server. Confirm \`npm run dev\` is running and this tab uses the same URL as the dev server (e.g. http://localhost:3000).`
            : msg,
      });
    } finally {
      setBusy(false);
    }
  }, [body, d.resultSuccessLead]);

  return (
    <section
      id="registry-draft-helper"
      className={
        embedInIntegrateSecondary
          ? "integrate-prose muted integrate-registry-draft-panel--secondary"
          : "integrate-prose muted"
      }
      data-testid="integrate-registry-draft-panel"
    >
      {embedInIntegrateSecondary ? null : <h2>{d.sectionHeading}</h2>}
      {d.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <ul>
        {d.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {embedInIntegrateSecondary ? null : (
        <details className="registry-draft-technical">
          <summary>{d.technicalSummary}</summary>
          <ul>
            {d.technicalFlowBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
            {d.technicalBullets.map((b) => (
              <li key={`registry-draft-constraint-${b}`}>{b}</li>
            ))}
          </ul>
        </details>
      )}
      <p>{d.requestLabel}</p>
      <textarea
        className="registry-draft-json"
        spellCheck={false}
        rows={embedInIntegrateSecondary ? 6 : 14}
        value={body}
        onChange={(ev) => setBody(ev.target.value)}
        aria-label={d.requestLabel}
      />
      <p>
        <button type="button" className="btn" disabled={busy} onClick={() => void submit()}>
          {d.submitLabel}
        </button>
      </p>
      {result?.kind === "success" ? (
        <div className="integrate-registry-draft-result" data-testid="integrate-registry-draft-result" role="status" aria-live="polite">
          <p className="integrate-registry-draft-result-lead">{result.lead}</p>
          <p className="integrate-registry-draft-result-actions">
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void copyDraftJson()}>
              {copyFeedback ? d.copiedDraftJsonFeedback : d.copyDraftJsonLabel}
            </button>
          </p>
          <textarea
            className="registry-draft-json registry-draft-json--draft-output"
            readOnly
            spellCheck={false}
            rows={outputRows}
            value={result.json}
            aria-label={d.draftJsonOutputLabel}
            data-testid="integrate-registry-draft-result-json"
            onFocus={(ev) => ev.currentTarget.select()}
          />
        </div>
      ) : null}
      {result?.kind === "error" ? (
        <div data-testid="integrate-registry-draft-result" role="alert">
          <pre className="registry-draft-json registry-draft-json--error">
            <code>{result.text}</code>
          </pre>
        </div>
      ) : null}
      {embedInIntegrateSecondary ? (
        <details className="registry-draft-technical registry-draft-technical--embed-tail">
          <summary>{d.technicalSummary}</summary>
          <ul>
            {d.technicalFlowBullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
            {d.technicalBullets.map((b) => (
              <li key={`registry-draft-constraint-${b}`}>{b}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
