"use client";

import { LiveStatus } from "@/components/LiveStatus";
import { conversionSpine, productCopy } from "@/content/productCopy";
import type { PlanRow } from "@/lib/commercialNarrative";
import type { PlanId } from "@/lib/plans";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";

const PRICING_SIGNIN_HREF = "/auth/signin?callbackUrl=%2Fpricing";

export type BillingInterval = "monthly" | "yearly";

export type { PlanRow } from "@/lib/commercialNarrative";

function paidCheckoutCtaLabel(plan: PlanId): string {
  if (plan === "team") return "Continue to checkout";
  const ctas = productCopy.pricingPlanCtas;
  if (plan === "individual") return ctas.individual.checkoutLabel;
  if (plan === "business") return ctas.business.checkoutLabel;
  return "Continue to checkout";
}

function paidSignInCtaLabel(plan: PlanId): string {
  if (plan === "team") return "Sign in to continue";
  const ctas = productCopy.pricingPlanCtas;
  if (plan === "individual") return "Start free";
  if (plan === "business") return ctas.business.signInLabel;
  return "Get started";
}

function formatIncludedLine(p: PlanRow): string {
  if (p.id === "enterprise") {
    return "Custom pricing and limits";
  }
  if (p.includedMonthly === null) {
    return "Custom";
  }
  return `${p.includedMonthly.toLocaleString()} verifications / month (included, per key)`;
}

export function PricingClient({
  plans,
  enterpriseMailto,
}: {
  plans: PlanRow[];
  enterpriseMailto: string;
}) {
  const { status } = useSession();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const authed = status === "authenticated";

  async function checkout(plan: PlanId) {
    setErr(null);
    setLoading(plan);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      const text = await r.text();
      let j: { url?: string; error?: string; message?: string };
      try {
        j = JSON.parse(text) as { url?: string; error?: string; message?: string };
      } catch {
        setErr(
          r.ok
            ? "Unexpected response from checkout. Please refresh and try again."
            : `Checkout failed (${r.status}). If this persists, contact support.`,
        );
        return;
      }
      if (!r.ok) {
        setErr(j.message || j.error || "Checkout failed");
        return;
      }
      if (typeof j.url === "string" && j.url.length > 0) {
        window.location.assign(j.url);
        return;
      }
      setErr(j.error ?? "Checkout did not return a payment link. Check Stripe configuration.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error starting checkout.");
    } finally {
      setLoading(null);
    }
  }

  const hasYearly = plans.some((p) => p.checkoutPlanId && p.displayPriceYearly);
  return (
    <>
      {err && (
        <LiveStatus mode="assertive">
          <p className="error-text">{err}</p>
        </LiveStatus>
      )}
      {hasYearly ? (
        <p className="pricing-billing-interval-toggle muted" data-testid="pricing-billing-interval">
          <span>Billing: </span>
          <label className="u-mr-1">
            <input
              type="radio"
              name="billing-interval"
              value="monthly"
              checked={billingInterval === "monthly"}
              onChange={() => {
                setBillingInterval("monthly");
              }}
            />{" "}
            Monthly
          </label>
          <label>
            <input
              type="radio"
              name="billing-interval"
              value="yearly"
              checked={billingInterval === "yearly"}
              onChange={() => {
                setBillingInterval("yearly");
              }}
            />{" "}
            Annual (save 20%)
          </label>
        </p>
      ) : null}
      <div className="pricing-grid pricing-grid-after-hero">
        {plans.map((p) => {
          const displayPriceThis =
            billingInterval === "yearly" && p.displayPriceYearly
              ? p.displayPriceYearly
              : p.displayPrice;
          return (
            <div
              key={p.id}
              className={`card pricing-card-${p.id}${p.recommended ? " pricing-card-recommended" : ""}`}
              data-plan={p.id}
              data-recommended={p.recommended ? "true" : "false"}
              aria-label={
                p.recommended
                  ? `${p.headline} — ${productCopy.pricingRecommendedPill}`
                  : undefined
              }
            >
              {p.recommended && (
                <p className="pricing-recommended-pill" data-testid="pricing-recommended-pill">
                  {productCopy.pricingRecommendedPill}
                </p>
              )}
              <h2>{p.headline}</h2>
              <p className="pricing-card-price" data-testid={`pricing-card-price-${p.id}`}>
                {displayPriceThis}
              </p>
              <p
                className="pricing-card-quota muted"
                data-included-monthly={p.includedMonthly ?? "custom"}
              >
                {formatIncludedLine(p)}
              </p>
              {p.overageDisplayLabel && p.id !== "starter" && p.id !== "enterprise" ? (
                <p className="pricing-card-overage muted" data-testid={`pricing-overage-${p.id}`}>
                  {p.overageDisplayLabel}
                </p>
              ) : p.id === "enterprise" && p.overageDisplayLabel ? (
                <p className="pricing-card-overage muted">{p.overageDisplayLabel}</p>
              ) : null}
              <p className="pricing-card-outcome muted">
                <strong>Best for:</strong> {p.audience}
              </p>
              <p className="pricing-card-includes muted">
                <strong>What you get:</strong> {p.valueUnlock}
              </p>
              {p.id === "starter" && (
                <Link
                  className="btn-pricing-secondary pricing-card-cta"
                  href={productCopy.pricingPlanCtas.starter.href}
                  data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
                >
                  {productCopy.pricingPlanCtas.starter.label}
                </Link>
              )}
              {p.checkoutPlanId !== null &&
                (authed ? (
                  <button
                    type="button"
                    className={`pricing-card-cta${p.recommended ? " pricing-cta-emphasized" : ""}`}
                    disabled={loading !== null}
                    onClick={() => checkout(p.checkoutPlanId!)}
                    data-cta-priority={
                      p.recommended
                        ? conversionSpine.ctaPriorityPrimaryValue
                        : conversionSpine.ctaPrioritySecondaryValue
                    }
                  >
                    {loading === p.checkoutPlanId ? "…" : paidCheckoutCtaLabel(p.checkoutPlanId!)}
                  </button>
                ) : (
                  <Link
                    className={`pricing-card-cta${p.recommended ? " pricing-cta-emphasized" : ""} btn-pricing-secondary`}
                    href={PRICING_SIGNIN_HREF}
                    data-cta-priority={
                      p.recommended
                        ? conversionSpine.ctaPriorityPrimaryValue
                        : conversionSpine.ctaPrioritySecondaryValue
                    }
                  >
                    {paidSignInCtaLabel(p.checkoutPlanId!)}
                  </Link>
                ))}
              {p.id === "enterprise" && (
                <a
                  className="btn pricing-card-cta"
                  href={enterpriseMailto}
                  data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
                >
                  {productCopy.pricingPlanCtas.enterprise.label}
                </a>
              )}
              {p.id === "team" && productCopy.pricingTeamFootnote.length > 0 && (
                <p className="pricing-team-footnote muted" data-testid="pricing-team-footnote">
                  {productCopy.pricingTeamFootnote}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
