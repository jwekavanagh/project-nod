"use client";

import type { MouseEvent } from "react";
import { useCallback, useState } from "react";

export type VerifyDeveloperEvidenceProps = {
  humanReport: string;
  outcomeCertificateJson: string;
};

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function stopSummaryToggle(e: { preventDefault: () => void; stopPropagation: () => void }) {
  e.preventDefault();
  e.stopPropagation();
}

export function VerifyDeveloperEvidence(props: VerifyDeveloperEvidenceProps) {
  const { humanReport, outcomeCertificateJson } = props;
  const [humanFeedback, setHumanFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [jsonFeedback, setJsonFeedback] = useState<"idle" | "copied" | "error">("idle");

  const copyHuman = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      stopSummaryToggle(e);
      const ok = await writeClipboard(humanReport);
      setHumanFeedback(ok ? "copied" : "error");
      window.setTimeout(() => setHumanFeedback("idle"), ok ? 2000 : 2800);
    },
    [humanReport],
  );

  const copyJson = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      stopSummaryToggle(e);
      const ok = await writeClipboard(outcomeCertificateJson);
      setJsonFeedback(ok ? "copied" : "error");
      window.setTimeout(() => setJsonFeedback("idle"), ok ? 2000 : 2800);
    },
    [outcomeCertificateJson],
  );

  const humanBtn =
    humanFeedback === "copied" ? "Copied" : humanFeedback === "error" ? "Copy failed" : "Copy report";
  const jsonBtn =
    jsonFeedback === "copied" ? "Copied" : jsonFeedback === "error" ? "Copy failed" : "Copy JSON";

  return (
    <>
      <details className="verify-page-evidence-details verify-page-evidence-details--human">
        <summary className="verify-page-evidence-summary">
          <span className="verify-page-evidence-summary-title">Human-readable report</span>
          <button
            type="button"
            className="btn secondary verify-page-evidence-copy"
            aria-label="Copy human-readable report to clipboard"
            onClick={copyHuman}
            onPointerDown={stopSummaryToggle}
          >
            {humanBtn}
          </button>
        </summary>
        <div className="verify-page-evidence-shell verify-page-evidence-shell--human">
          <div className="verify-page-evidence-scroll" tabIndex={-1}>
            <pre className="verify-page-evidence-pre verify-page-evidence-pre--human">{humanReport}</pre>
          </div>
        </div>
      </details>

      <details className="verify-page-evidence-details verify-page-evidence-details--json">
        <summary className="verify-page-evidence-summary">
          <span className="verify-page-evidence-summary-title">Outcome Certificate JSON</span>
          <button
            type="button"
            className="btn secondary verify-page-evidence-copy"
            aria-label="Copy Outcome Certificate JSON to clipboard"
            onClick={copyJson}
            onPointerDown={stopSummaryToggle}
          >
            {jsonBtn}
          </button>
        </summary>
        <div className="verify-page-evidence-shell verify-page-evidence-shell--json">
          <div className="verify-page-evidence-scroll" tabIndex={-1}>
            <pre className="verify-page-evidence-pre verify-page-evidence-pre--json">{outcomeCertificateJson}</pre>
          </div>
        </div>
      </details>
    </>
  );
}
