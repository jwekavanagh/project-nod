"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import type { CommercialAccountStatePayload } from "@/lib/commercialAccountState";

const ghMain = `${publicProductAnchors.gitRepositoryUrl}/blob/main`;

export function AccountClient({
  hasKey,
  initialCommercial,
}: {
  hasKey: boolean;
  initialCommercial: CommercialAccountStatePayload;
}) {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const expectedPlanRaw = searchParams.get("expectedPlan");

  const [key, setKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [commercial, setCommercial] = useState<CommercialAccountStatePayload>(initialCommercial);
  const [activationUi, setActivationUi] = useState<"idle" | "pending" | "ready" | "timeout">("idle");

  useEffect(() => {
    setCommercial(initialCommercial);
  }, [initialCommercial]);

  useEffect(() => {
    if (checkout !== "success" || !expectedPlanRaw) {
      setActivationUi("idle");
      return;
    }
    let cancelled = false;
    setActivationUi("pending");

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    void (async () => {
      for (let i = 0; i < 30; i++) {
        if (cancelled) return;
        const r = await fetch(
          `/api/account/commercial-state?expectedPlan=${encodeURIComponent(expectedPlanRaw)}`,
        );
        if (cancelled) return;
        if (!r.ok) {
          await sleep(1000);
          continue;
        }
        const j = (await r.json()) as CommercialAccountStatePayload;
        setCommercial(j);
        if (j.checkoutActivationReady) {
          if (!cancelled) setActivationUi("ready");
          return;
        }
        if (i === 29) {
          if (!cancelled) setActivationUi("timeout");
          return;
        }
        await sleep(1000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkout, expectedPlanRaw]);

  async function createKey() {
    setErr(null);
    const r = await fetch("/api/account/create-key", { method: "POST" });
    const j = (await r.json()) as { apiKey?: string; error?: string };
    if (!r.ok) {
      setErr(j.error ?? "Failed");
      return;
    }
    if (j.apiKey) setKey(j.apiKey);
  }

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h2>Subscription and entitlements</h2>
      <p>
        <strong>Plan:</strong> {commercial.plan}
      </p>
      <p>
        <strong>Subscription status:</strong> {commercial.subscriptionStatus}
      </p>
      <p>
        <strong>Stripe price mapping:</strong> {commercial.priceMapping}
      </p>
      {checkout === "success" && expectedPlanRaw && (
        <div style={{ marginTop: "0.75rem" }}>
          {activationUi === "pending" && (
            <p className="muted" data-testid="checkout-activation-pending">
              Finishing subscription setup… This usually takes a few seconds. You can refresh the page
              if it does not update.
            </p>
          )}
          {activationUi === "ready" && (
            <p style={{ color: "var(--muted)" }} data-testid="checkout-activation-ready">
              Your subscription is active. You can use licensed verify with your API key.
            </p>
          )}
          {activationUi === "timeout" && (
            <p style={{ color: "#f4212e" }} data-testid="checkout-activation-timeout">
              Still processing—refresh in a minute or contact the operator if this persists.
            </p>
          )}
        </div>
      )}
      <p style={{ marginTop: "0.75rem" }}>{commercial.entitlementSummary}</p>

      <h2 style={{ marginTop: "1.5rem" }}>API key</h2>
      {!hasKey && !key && (
        <button type="button" onClick={createKey}>
          Generate API key
        </button>
      )}
      {err && <p style={{ color: "#f4212e" }}>{err}</p>}
      {key && (
        <p data-testid="api-key-plaintext" style={{ wordBreak: "break-all", marginTop: "0.75rem" }}>
          {key}
        </p>
      )}
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.75rem" }}>
        Use <code>WORKFLOW_VERIFIER_API_KEY</code> with the commercial CLI after you have an active paid
        subscription. Machine contracts:{" "}
        <a href="/openapi-commercial-v1.yaml">OpenAPI</a>,{" "}
        <a href="/api/v1/commercial/plans">plans JSON</a>. Start from <a href="/integrate">Integrate</a> for a
        copy-paste first run on your database. Entitlements:{" "}
        <a href={`${ghMain}/docs/commercial-entitlement-matrix.md`} rel="noreferrer">
          commercial-entitlement-matrix.md
        </a>
        ,{" "}
        <a href={`${ghMain}/docs/commercial-entitlement-policy.md`} rel="noreferrer">
          commercial-entitlement-policy.md
        </a>
        . <a href="/pricing">Pricing</a>.
      </p>
    </div>
  );
}
