"use client";

import { productCopy } from "@/content/productCopy";
import { LiveStatus } from "@/components/LiveStatus";
import { demoVerifySuccessResponseSchema } from "@/lib/demoVerifySuccessResponse.client";
import {
  DEMO_SCENARIO_IDS,
  DEMO_SCENARIO_PRESENTATION,
  type DemoScenarioId,
} from "@/lib/demoScenarioIds";
import { createElement, useState } from "react";

type DemoResponse =
  | { ok: true; humanReport: string; certificate: unknown }
  | { ok: false; error: string };

export type TryItSectionProps = {
  /** Nested under hero `<section>` — render as `div`+`role="region"` (valid HTML). */
  variant?: "page" | "heroEmbedded";
};

export function TryItSection({ variant = "page" }: TryItSectionProps) {
  const [scenarioId, setScenarioId] = useState<DemoScenarioId>("wf_complete");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResponse | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/demo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const text = await r.text();
      let j: Record<string, unknown>;
      try {
        j = JSON.parse(text) as Record<string, unknown>;
      } catch {
        setResult({
          ok: false,
          error: `Request failed (${r.status}). The demo endpoint did not return JSON.`,
        });
        return;
      }
      if (!r.ok) {
        setResult({
          ok: false,
          error: typeof j.error === "string" ? j.error : `HTTP ${r.status}`,
        });
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
      setResult({ ok: false, error: "Unexpected response" });
    } catch {
      setResult({ ok: false, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const embedded = variant === "heroEmbedded";
  const rootClassName = embedded ? "home-hero-try-it" : "home-section";
  const tag = embedded ? "div" : "section";

  const inner = (
    <>
      <h2 id="try-it-heading">{productCopy.tryIt.title}</h2>
      <p className="muted">{embedded ? productCopy.tryIt.introHeroEmbed : productCopy.tryIt.intro}</p>
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
          onChange={(e) => setScenarioId(e.target.value as DemoScenarioId)}
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
      </div>
      <p className="muted try-it-scenario-hint" data-testid="try-it-scenario-one-liner">
        {DEMO_SCENARIO_PRESENTATION[scenarioId].oneLiner}
      </p>
      {result && !result.ok && (
        <LiveStatus mode="assertive">
          <p className="error-text">{result.error}</p>
        </LiveStatus>
      )}
      {result && result.ok && (
        <LiveStatus mode="polite">
          <p className="muted">{productCopy.tryIt.a11ySuccessAnnouncement}</p>
        </LiveStatus>
      )}
      {result && result.ok && (
        <div className="try-it-output">
          <h3 className="try-it-subheading">Human report</h3>
          <pre className="code-block" data-testid={productCopy.uiTestIds.tryTruthReport}>
            {result.humanReport}
          </pre>
          <h3 className="try-it-subheading">Outcome certificate (JSON)</h3>
          <pre className="code-block" data-testid={productCopy.uiTestIds.tryWorkflowJson}>
            {JSON.stringify(result.certificate, null, 2)}
          </pre>
        </div>
      )}
    </>
  );

  return createElement(
    tag,
    {
      id: "try-it",
      className: rootClassName,
      "data-testid": productCopy.uiTestIds.tryIt,
      "aria-labelledby": "try-it-heading",
      "aria-busy": loading,
      ...(embedded ? { role: "region" as const } : {}),
    },
    inner,
  );
}
