"use client";

import { productCopy } from "@/content/productCopy";
import {
  type DemoVerifyErrorUserCopy,
  demoVerifyNetworkErrorCopy,
  demoVerifyNonJsonResponseCopy,
  demoVerifyUnexpectedSuccessResponseCopy,
  getDemoVerifyErrorCopy,
  shareReportClipboardErrorCopy,
  shareReportInvalidResponseCopy,
  shareReportPublicOffCopy,
} from "@/content/demoVerifyUserCopy";
import { LiveStatus } from "@/components/LiveStatus";
import { demoVerifySuccessResponseSchema } from "@/lib/demoVerifySuccessResponse.client";
import {
  DEMO_SCENARIO_IDS,
  DEMO_SCENARIO_PRESENTATION,
  isDemoScenarioId,
  type DemoScenarioId,
} from "@/lib/demoScenarios";
import { buildDemoResultSummary } from "@/lib/demoResultSummary";
import { shareDemoOutcomeCertificate } from "@/lib/shareDemoPublicReport";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type DemoResult =
  | { ok: true; humanReport: string; certificate: unknown }
  | { ok: false; title: string; body: string; requestId?: string };

export type TryItSectionProps = {
  initialScenarioId: DemoScenarioId;
};

export function TryItSection({ initialScenarioId }: TryItSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scenarioId, setScenarioId] = useState<DemoScenarioId>(initialScenarioId);
  const [loading, setLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareErr, setShareErr] = useState<DemoVerifyErrorUserCopy | null>(null);

  useEffect(() => {
    const raw = searchParams.get("demo");
    if (raw !== null && !isDemoScenarioId(raw)) {
      router.replace("/?demo=wf_missing#try-it");
      setScenarioId("wf_missing");
      return;
    }
    if (raw && isDemoScenarioId(raw) && raw !== scenarioId) {
      setScenarioId(raw);
    }
  }, [searchParams, router, scenarioId]);

  const onScenarioChange = useCallback(
    (id: DemoScenarioId) => {
      setScenarioId(id);
      router.replace(`/?demo=${id}#try-it`);
    },
    [router],
  );

  async function run() {
    setLoading(true);
    setResult(null);
    setShareNotice(null);
    setShareErr(null);
    try {
      const r = await fetch("/api/demo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const requestId = r.headers.get("x-request-id") ?? undefined;
      const text = await r.text();
      let j: Record<string, unknown>;
      try {
        j = JSON.parse(text) as Record<string, unknown>;
      } catch {
        setResult({
          ok: false,
          ...demoVerifyNonJsonResponseCopy,
          requestId,
        });
        return;
      }
      if (!r.ok) {
        const code = typeof j.error === "string" ? j.error : "";
        const copy = getDemoVerifyErrorCopy(code);
        setResult({ ok: false, ...copy, requestId });
        return;
      }
      const parsed = demoVerifySuccessResponseSchema.safeParse(j);
      if (parsed.success) {
        setResult({
          ok: true,
          humanReport: parsed.data.humanReport,
          certificate: parsed.data.certificate,
        });
        return;
      }
      setResult({
        ok: false,
        ...demoVerifyUnexpectedSuccessResponseCopy,
        requestId,
      });
    } catch {
      setResult({ ok: false, ...demoVerifyNetworkErrorCopy });
    } finally {
      setLoading(false);
    }
  }

  async function copyScenarioLink() {
    const url = `${window.location.origin}/?demo=${scenarioId}#try-it`;
    await navigator.clipboard.writeText(url);
  }

  async function share() {
    if (!result?.ok) return;
    setShareLoading(true);
    setShareNotice(null);
    setShareErr(null);
    try {
      const out = await shareDemoOutcomeCertificate(result.certificate);
      if (out.kind === "clipboard_off") {
        setShareNotice(shareReportPublicOffCopy.announcement);
      } else if (out.kind === "clipboard_failed") {
        setShareErr(shareReportClipboardErrorCopy);
      } else if (out.kind === "invalid_response") {
        setShareErr(shareReportInvalidResponseCopy);
      }
    } finally {
      setShareLoading(false);
    }
  }

  const summary =
    result?.ok === true ? buildDemoResultSummary(result.certificate, scenarioId) : null;

  return (
    <section
      id="try-it"
      className="home-section home-try-it"
      data-testid={productCopy.uiTestIds.tryIt}
      aria-labelledby="try-it-heading"
      aria-busy={loading}
    >
      <h2 id="try-it-heading">{productCopy.tryIt.title}</h2>
      <p className="muted">{productCopy.tryIt.intro}</p>
      <p className="muted">Flow: choose scenario, run verification, inspect verdict, then continue with your own data.</p>
      <p className="muted try-it-pre-frame" data-testid="try-it-pre-button-framing">
        {productCopy.tryIt.preButtonFraming}
      </p>
      <div className="try-it-controls">
        <label className="try-it-label" htmlFor="scenario-select">
          {productCopy.tryIt.scenarioLabel}
        </label>
        <select
          id="scenario-select"
          className="try-it-select"
          value={scenarioId}
          onChange={(e) => onScenarioChange(e.target.value as DemoScenarioId)}
        >
          {DEMO_SCENARIO_IDS.map((id) => {
            const { label } = DEMO_SCENARIO_PRESENTATION[id];
            return (
              <option key={id} value={id}>
                {label} ({id})
              </option>
            );
          })}
        </select>
        <button type="button" className="btn try-it-run" disabled={loading} onClick={run}>
          {loading ? productCopy.tryIt.running : productCopy.tryIt.runButton}
        </button>
        <button type="button" className="btn secondary try-it-copy-link" onClick={copyScenarioLink}>
          {productCopy.tryIt.copyScenarioLinkButton}
        </button>
      </div>
      <p className="muted try-it-scenario-hint" data-testid="try-it-scenario-one-liner">
        {DEMO_SCENARIO_PRESENTATION[scenarioId].oneLiner}
      </p>
      {result && !result.ok && (
        <LiveStatus mode="assertive">
          <p className="error-text try-it-error-title">
            <strong>{result.title}</strong>
          </p>
          <p className="error-text try-it-error-body">{result.body}</p>
          {result.requestId ? (
            <p className="muted try-it-request-id" data-testid="try-it-request-id">
              Request ID: <code>{result.requestId}</code>
            </p>
          ) : null}
        </LiveStatus>
      )}
      {shareErr && (
        <LiveStatus mode="assertive">
          <p className="error-text">
            <strong>{shareErr.title}</strong>
          </p>
          <p className="error-text">{shareErr.body}</p>
        </LiveStatus>
      )}
      {shareNotice && (
        <LiveStatus mode="assertive" data-testid="try-it-share-clipboard-notice">
          {shareNotice}
        </LiveStatus>
      )}
      {result && result.ok && (
        <LiveStatus mode="polite">
          <p className="muted">{productCopy.tryIt.a11ySuccessAnnouncement}</p>
        </LiveStatus>
      )}
      {result && result.ok && (
        <div className="try-it-output" data-testid="try-it-output">
          {summary && (
            <div className="try-it-verdict-card" data-testid="try-it-verdict-card">
              <h3 className="try-it-subheading">Result at a glance</h3>
              <ul className="try-it-verdict-bullets">
                <li>
                  <span className="try-it-k">Scenario</span> {summary.scenario}
                </li>
                <li>
                  <span className="try-it-k">Reality</span> {summary.reality}
                </li>
                <li>
                  <span className="try-it-k">Verdict</span> {summary.verdictLine}
                </li>
                <li>
                  <span className="try-it-k">Why it matters</span> {summary.whyItMatters}
                </li>
              </ul>
            </div>
          )}
          <p className="try-it-output-actions">
            <button
              type="button"
              className="btn secondary try-it-share"
              disabled={shareLoading}
              onClick={share}
            >
              {shareLoading ? productCopy.tryIt.running : productCopy.tryIt.shareReportButton}
            </button>
          </p>
          <p className="home-cta-row">
            <Link href="/integrate" className="btn" data-cta-priority="primary">
              {productCopy.ctaTaxonomy.decision}
            </Link>
          </p>
          <details className="try-it-human-details" data-testid="try-it-human-details">
            <summary>Full human report</summary>
            <pre className="code-block" data-testid={productCopy.uiTestIds.tryTruthReport}>
              {result.humanReport}
            </pre>
          </details>
          <h3 className="try-it-subheading">Raw outcome</h3>
          <details className="try-it-json-details" data-testid="try-it-raw-outcome">
            <summary>Full verification JSON</summary>
            <pre className="code-block" data-testid={productCopy.uiTestIds.tryWorkflowJson}>
              {JSON.stringify(result.certificate, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
