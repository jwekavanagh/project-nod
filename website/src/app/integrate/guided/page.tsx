"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import marketing from "@/lib/marketing";

const DEFAULT_OPENAI_ENVELOPE = JSON.stringify(
  {
    inputKind: "openai_tool_calls_v1",
    schemaVersion: 1,
    draftProvider: "hosted_openai",
    workflowId: "wf_bootstrap_fixture",
    tool_calls: [
      {
        id: "call_fixture_1",
        type: "function",
        function: {
          name: "crm.upsert_contact",
          arguments: JSON.stringify({
            recordId: "c_ok",
            fields: { name: "Alice", status: "active" },
          }),
        },
      },
    ],
  },
  null,
  2,
);

const DEFAULT_BOOTSTRAP_ENVELOPE = JSON.stringify(
  {
    inputKind: "bootstrap_pack_v1",
    schemaVersion: 1,
    draftProvider: "hosted_openai",
    bootstrapPackInput: {
      schemaVersion: 1,
      workflowId: "wf_integrate_spine",
      openaiChatCompletion: {
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "call_integrate_spine_1",
                  type: "function",
                  function: {
                    name: "crm.upsert_contact",
                    arguments: JSON.stringify({
                      recordId: "c_integrate_spine",
                      fields: { name: "Alice", status: "active" },
                    }),
                  },
                },
              ],
            },
          },
        ],
      },
    },
  },
  null,
  2,
);

/** POST /api/integrator/registry-draft success body (schemas/registry-draft-response.schema.json). */
type DraftEngineResponseSuccess = {
  schemaVersion: 3;
  draft: { tools: unknown[] };
  quickIngestInput: { encoding: string; body: string };
  readiness: { status: "ready" | "review" | "blocked"; reasons: string[] };
  generation?: { backend: string; model: string };
};

function preflightEnvelope(obj: unknown): string | null {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return "Request body must be a JSON object.";
  }
  const o = obj as Record<string, unknown>;
  if (o.schemaVersion !== 1) return "Expected schemaVersion: 1 in the envelope.";
  const kind = o.inputKind;
  if (kind !== "bootstrap_pack_v1" && kind !== "openai_tool_calls_v1") {
    return `inputKind must be bootstrap_pack_v1 or openai_tool_calls_v1 — got "${String(kind)}".`;
  }
  return null;
}

function copyToClipboard(text: string): void {
  void navigator.clipboard.writeText(text);
}

const ENFORCE_DOC_HREF = "https://github.com/jwekavanagh/agentskeptic/blob/main/docs/agentskeptic.md";

export default function IntegrateGuidedPage() {
  const p = marketing.integratePage;
  const quickOneLine = useMemo(
    () => p.quickVerifyCommand.replace(/\\\n/g, " ").replace(/\s+/g, " ").trim(),
    [p.quickVerifyCommand],
  );
  const [mode, setMode] = useState<"openai" | "bootstrap">("openai");
  const [bodyText, setBodyText] = useState(DEFAULT_OPENAI_ENVELOPE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftEngineResponseSuccess | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const setModeAndTemplate = (m: "openai" | "bootstrap") => {
    setMode(m);
    setBodyText(m === "openai" ? DEFAULT_OPENAI_ENVELOPE : DEFAULT_BOOTSTRAP_ENVELOPE);
    setError(null);
    setResult(null);
  };

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setResult(null);
      setUnavailable(false);
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText) as unknown;
      } catch {
        setError("Request body is not valid JSON.");
        setLoading(false);
        return;
      }
      const pre = preflightEnvelope(parsed);
      if (pre) {
        setError(pre);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/integrator/registry-draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed),
        });
        if (res.status === 404) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        const j = (await res.json()) as { code?: string; message?: string; errors?: unknown };
        if (!res.ok) {
          setError(
            typeof j.message === "string" ? j.message : j.code ?? `HTTP ${res.status}`,
          );
          setLoading(false);
          return;
        }
        setResult(j as DraftEngineResponseSuccess);
      } catch {
        setError("Request failed. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [bodyText],
  );

  const toolsFileText = result
    ? `${JSON.stringify(result.draft.tools, null, 2)}\n`
    : "";
  const quickBody = result?.quickIngestInput.body ?? "";

  return (
    <main
      className="integrate-main integrate-prose registry-draft-technical"
      data-testid="integrate-guided-page"
    >
      <h1>Guided activation</h1>
      <p className="lede">
        Your <strong>first proof</strong> is <code>agentskeptic quick</code> on captured tool activity against a readable
        database (stdout <code>QuickVerifyReport</code>). The form below prepares local NDJSON + a suggested command;
        use <strong>Formalize</strong> only when you want a repeatable registry for <code>agentskeptic check</code> and
        CI.
      </p>
      <p className="lede muted">
        <Link href="/integrate">Back to Get started</Link> ·{" "}
        <a
          href="https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/docs/integrate.md"
          rel="noopener noreferrer"
          target="_blank"
        >
          integrate.md
        </a>{" "}
        (raw)
      </p>

      <section
        className="integrate-registry-draft-secondary"
        data-testid="integrate-guided-graduation"
        aria-label="Graduate from preview to contract and CI"
      >
        <h2>After your first proof</h2>
        <ol className="lede">
          <li>
            <strong>Preview confidence:</strong> keep using <code>agentskeptic quick</code> for cheap reads; it stays
            preview-only for high-stakes reliance (see <code>highStakesReliance</code> in{" "}
            <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank">
              docs/integrate.md
            </a>
            ).
          </li>
          <li>
            <strong>Decision-grade verification:</strong> run <code>agentskeptic check</code> with a saved registry and
            events when a human decision depends on the artifact.
          </li>
          <li>
            <strong>Repeatable verification / CI gate:</strong> use <code>agentskeptic enforce</code> for lifecycle
            baselines in CI — see{" "}
            <a href={ENFORCE_DOC_HREF} rel="noopener noreferrer" target="_blank">
              docs/agentskeptic.md (enforce)
            </a>
            .
          </li>
        </ol>
      </section>

      {unavailable && (
        <p className="lede" role="alert">
          Registry draft is not available on this deployment. For operators: set <code>REGISTRY_DRAFT_ENABLED=1</code>.
          Hosted drafting also needs <code>OPENAI_API_KEY</code>; local Ollama drafting needs{" "}
          <code>AGENTSKEPTIC_DRAFT_LOCAL_MODEL</code> and a reachable Ollama <code>/api/chat</code> endpoint.
        </p>
      )}

      <form onSubmit={onSubmit} className="registry-draft-constraints-nested" aria-label="Registry draft request">
        <p>
          <strong>Input kind</strong>
        </p>
        <label className="integrate-funnel-anon-hint" style={{ display: "block", marginBottom: "0.5rem" }}>
          <input
            type="radio"
            name="inputKind"
            checked={mode === "openai"}
            onChange={() => setModeAndTemplate("openai")}
          />{" "}
          OpenAI tool calls (<code>openai_tool_calls_v1</code>)
        </label>
        <label className="integrate-funnel-anon-hint" style={{ display: "block", marginBottom: "1rem" }}>
          <input
            type="radio"
            name="inputKind"
            checked={mode === "bootstrap"}
            onChange={() => setModeAndTemplate("bootstrap")}
          />{" "}
          Bootstrap pack JSON (<code>bootstrap_pack_v1</code>)
        </label>
        <label className="registry-draft-technical--embed-tail" htmlFor="registry-draft-body">
          Request JSON (per{" "}
          <code>schemas/registry-draft-request-v1.schema.json</code> — optional{" "}
          <code>draftProvider</code>: <code>hosted_openai</code> | <code>local_ollama</code>)
        </label>
        <textarea
          id="registry-draft-body"
          className="integrate-pack-command"
          style={{ width: "100%", minHeight: 220, fontFamily: "var(--font-mono, monospace)", fontSize: "0.9rem" }}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          spellCheck={false}
        />
        <p className="home-cta-row" style={{ marginTop: "1rem" }}>
          <button className="btn" type="submit" disabled={loading} data-testid="integrate-guided-generate">
            {loading ? "Generating…" : "Generate artifacts"}
          </button>
        </p>
      </form>

      {error && (
        <p className="lede" role="alert" data-testid="integrate-guided-error">
          {error}
        </p>
      )}

      {result && (
        <section
          className="integrate-registry-draft-secondary"
          data-testid="integrate-guided-results"
          aria-label="Generated draft and quick input"
        >
          <h2>Copy artifacts</h2>
          <div className="integrate-registry-draft-panel--secondary">
            <p className="lede muted" data-testid="integrate-guided-readiness">
              <strong>Readiness</strong>: <code>{result.readiness.status}</code>
              {" — backend "}
              <code>{result.generation?.backend ?? "?"}</code>, model{" "}
              <code>{result.generation?.model ?? "?"}</code>. Review <code>readiness.reasons</code> in the response JSON
              before shipping.
            </p>
            <p>
              <strong>1) quick-input.ndjson</strong> (ingest for <code>--input</code>)
            </p>
            <pre
              className="integrate-pack-command"
              data-testid="integrate-guided-ndjson"
            >{quickBody}</pre>
            <p>
              <button
                type="button"
                className="btn secondary"
                data-testid="integrate-guided-copy-ndjson"
                onClick={() => copyToClipboard(quickBody)}
              >
                Copy quick ingest
              </button>
            </p>
            <p>
              <strong>2) Run your first proof locally</strong> (edit paths; use <code>--postgres-url</code> instead of{" "}
              <code>--db</code> if you use Postgres). Read <code>QuickVerifyReport</code> on stdout.
            </p>
            <pre className="integrate-pack-command" data-testid="integrate-guided-command">
              {p.quickVerifyCommand}
            </pre>
            <p>
              <button
                type="button"
                className="btn"
                data-testid="integrate-guided-copy-cmd"
                onClick={() => copyToClipboard(quickOneLine)}
              >
                Copy one-line command
              </button>
            </p>
            <p>
              <strong>3) Formalize — tools.json</strong> (optional array for contract replay when this path matters)
            </p>
            <pre
              className="integrate-pack-command"
              data-testid="integrate-guided-tools-json"
            >{toolsFileText}</pre>
            <p>
              <button
                type="button"
                className="btn secondary"
                data-testid="integrate-guided-copy-tools"
                onClick={() => copyToClipboard(toolsFileText)}
              >
                Copy tools array
              </button>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
