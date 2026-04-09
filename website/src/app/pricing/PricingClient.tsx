"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export type PlanRow = {
  id: "starter" | "team" | "business" | "enterprise";
  headline: string;
  displayPrice: string;
  includedMonthly: number | null;
};

export function PricingClient({ plans }: { plans: PlanRow[] }) {
  const { status } = useSession();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(plan: "team" | "business") {
    setErr(null);
    setLoading(plan);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok) {
        setErr(j.error ?? "Checkout failed");
        return;
      }
      if (j.url) window.location.href = j.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <h1>Pricing</h1>
      <p style={{ color: "var(--muted)" }}>
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/auth/signin">Sign in</Link>
      </p>
      {err && <p style={{ color: "#f4212e" }}>{err}</p>}
      <div className="pricing-grid" style={{ marginTop: "1.5rem" }}>
        {plans.map((p) => (
          <div key={p.id} className="card" data-plan={p.id}>
            <h2>{p.headline}</h2>
            <p style={{ fontSize: "1.5rem" }}>{p.displayPrice}</p>
            <p
              data-included-monthly={p.includedMonthly ?? "custom"}
              style={{ color: "var(--muted)" }}
            >
              {p.includedMonthly === null
                ? "Custom"
                : `${p.includedMonthly.toLocaleString()} verifications / month`}
            </p>
            {p.id === "team" && (
              <button
                type="button"
                disabled={status !== "authenticated" || loading !== null}
                onClick={() => checkout("team")}
                style={{ marginTop: "0.75rem" }}
              >
                {loading === "team" ? "…" : "Subscribe"}
              </button>
            )}
            {p.id === "business" && (
              <button
                type="button"
                disabled={status !== "authenticated" || loading !== null}
                onClick={() => checkout("business")}
                style={{ marginTop: "0.75rem" }}
              >
                {loading === "business" ? "…" : "Subscribe"}
              </button>
            )}
            {p.id === "enterprise" && (
              <a
                className="btn"
                href="mailto:sales@example.com"
                style={{ display: "inline-block", marginTop: "0.75rem" }}
              >
                Contact sales
              </a>
            )}
          </div>
        ))}
      </div>
      {status !== "authenticated" && (
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
          Sign in to subscribe to Team or Business.
        </p>
      )}
    </>
  );
}
