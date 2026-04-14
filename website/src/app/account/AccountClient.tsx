"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CommercialAccountStatePayload } from "@/lib/commercialAccountState";
import type { AccountPageVerificationActivity } from "@/lib/funnelObservabilityQueries";
import type { PriceMapping } from "@/lib/accountEntitlementSummary";
import { LiveStatus } from "@/components/LiveStatus";
import { productCopy } from "@/content/productCopy";
import { accountAssertiveMessage } from "@/lib/accountAssertiveMessage";
import {
  STRIPE_CUSTOMER_MISSING_ERROR,
  STRIPE_CUSTOMER_MISSING_MESSAGE,
} from "@/lib/billingPortalConstants";
import {
  ACCOUNT_ACTIVITY_SCOPE_LINE,
  accountActivityMetaLine,
  accountActivityStatusLabel,
} from "@/lib/accountVerificationActivityUi";
import type { LicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";
import { SignOutButton } from "../SignOutButton";

function TrustFootnoteSecondLine({ text }: { text: string }) {
  const needle = "Security & Trust";
  const i = text.indexOf(needle);
  if (i < 0) {
    return (
      <p className="muted" style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>
        {text}
      </p>
    );
  }
  return (
    <p className="muted" style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>
      {text.slice(0, i)}
      <Link href="/security">{needle}</Link>
      {text.slice(i + needle.length)}
    </p>
  );
}

function billingSyncDisplay(mapping: PriceMapping): { label: string; title: string } {
  if (mapping === "mapped") {
    return {
      label: "Subscription linked to plan: OK",
      title: "Your Stripe subscription maps to your plan for quota and paid verification features.",
    };
  }
  return {
    label: "Subscription linked to plan: needs attention",
    title: "We have not finished linking your subscription to your plan in billing records yet.",
  };
}

function statusLabelFromRow(row: { terminalStatus: string }): string {
  const allowed: LicensedVerifyOutcomeMetadata["terminal_status"][] = [
    "complete",
    "inconsistent",
    "incomplete",
  ];
  const ts = row.terminalStatus;
  if (allowed.includes(ts as LicensedVerifyOutcomeMetadata["terminal_status"])) {
    return accountActivityStatusLabel(ts as LicensedVerifyOutcomeMetadata["terminal_status"]);
  }
  return row.terminalStatus;
}

export function AccountClient({
  hasKey,
  initialCommercial,
  activity,
}: {
  hasKey: boolean;
  initialCommercial: CommercialAccountStatePayload;
  activity: AccountPageVerificationActivity;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const expectedPlanRaw = searchParams.get("expectedPlan");

  const [key, setKey] = useState<string | null>(null);
  const [hasActiveKey, setHasActiveKey] = useState(hasKey);
  const [err, setErr] = useState<string | null>(null);
  const [commercial, setCommercial] = useState<CommercialAccountStatePayload>(initialCommercial);
  const [activationUi, setActivationUi] = useState<"idle" | "pending" | "ready" | "timeout">("idle");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalErr, setPortalErr] = useState<string | null>(null);

  const checkoutRefreshKeyRef = useRef<string | null>(null);

  const billing = billingSyncDisplay(commercial.priceMapping);

  const monthCount =
    activity.ok === true ? activity.licensedOutcomesThisUtcMonth : 0;

  useEffect(() => {
    setCommercial(initialCommercial);
  }, [initialCommercial]);

  useEffect(() => {
    setHasActiveKey(hasKey);
  }, [hasKey]);

  useEffect(() => {
    if (checkout !== "success" || !expectedPlanRaw) {
      checkoutRefreshKeyRef.current = null;
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

  useEffect(() => {
    if (activationUi !== "ready") return;
    if (checkout !== "success" || !expectedPlanRaw) return;
    const k = `${checkout}:${expectedPlanRaw}`;
    if (checkoutRefreshKeyRef.current === k) return;
    checkoutRefreshKeyRef.current = k;
    router.refresh();
  }, [activationUi, checkout, expectedPlanRaw, router]);

  async function openBillingPortal() {
    setPortalErr(null);
    setPortalLoading(true);
    try {
      const r = await fetch("/api/account/billing-portal", { method: "POST" });
      const j = (await r.json()) as { url?: string; error?: string; message?: string };
      if (r.status === 404 && j.error === STRIPE_CUSTOMER_MISSING_ERROR) {
        setPortalErr(j.message ?? STRIPE_CUSTOMER_MISSING_MESSAGE);
        return;
      }
      if (!r.ok) {
        setPortalErr(
          j.error === "Internal Server Error"
            ? "Billing portal is unavailable. Try again later."
            : (j.error ?? "Billing portal failed"),
        );
        return;
      }
      if (j.url) window.location.href = j.url;
    } finally {
      setPortalLoading(false);
    }
  }

  async function createKey() {
    setErr(null);
    const r = await fetch("/api/account/create-key", { method: "POST" });
    const j = (await r.json()) as { apiKey?: string; error?: string };
    if (!r.ok) {
      setErr(j.error ?? "Failed");
      return;
    }
    if (j.apiKey) {
      setKey(j.apiKey);
      setHasActiveKey(true);
    }
  }

  async function revokeKey() {
    if (
      !window.confirm(
        "Revoke your API key? Paid verification stops until you generate a new key.",
      )
    ) {
      return;
    }
    setErr(null);
    const r = await fetch("/api/account/revoke-key", { method: "POST" });
    const j = (await r.json()) as { ok?: boolean; revoked?: boolean; error?: string };
    if (r.status === 401) {
      setErr(j.error ?? "Unauthorized");
      return;
    }
    if (!r.ok || !j.ok) {
      setErr("Revoke failed");
      return;
    }
    setKey(null);
    setHasActiveKey(false);
    router.refresh();
  }

  function acknowledgeSavedKey() {
    setKey(null);
    router.refresh();
  }

  const showInactiveBillingCta = commercial.subscriptionStatus === "inactive";

  const assertiveAccountMessage = accountAssertiveMessage(portalErr, err, activationUi);

  const latestRow = activity.ok === true && activity.rows[0] ? activity.rows[0] : null;
  const showExactEmpty =
    activity.ok === true &&
    activity.rows.length === 0 &&
    activity.licensedOutcomesThisUtcMonth === 0;

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <p style={{ marginTop: 0, marginBottom: "1rem" }}>
        <SignOutButton variant="account" />
      </p>

      <section data-testid="account-verification-region">
        <h2 style={{ marginTop: 0 }}>Verification</h2>
        <p>
          <strong>Outcomes this billing month (UTC):</strong> {monthCount}
        </p>
        {latestRow ? (
          <p className="muted">
            <strong>Most recent row:</strong> {statusLabelFromRow(latestRow)} ·{" "}
            {accountActivityMetaLine(
              latestRow.workloadClass as LicensedVerifyOutcomeMetadata["workload_class"],
              latestRow.subcommand as LicensedVerifyOutcomeMetadata["subcommand"],
            )}
          </p>
        ) : null}
        <p className="muted" data-testid="account-activity-scope">
          {ACCOUNT_ACTIVITY_SCOPE_LINE}
        </p>
        {activity.ok === false ? (
          <p className="muted" data-testid="account-activity-error">
            {productCopy.account.activityLoadError}
          </p>
        ) : showExactEmpty ? (
          <p className="muted">{productCopy.account.activityEmpty}</p>
        ) : (
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
            {activity.rows.map((row) => (
              <li key={row.createdAtIso} style={{ marginBottom: "0.35rem" }}>
                <span>{statusLabelFromRow(row)}</span>
                <span className="muted"> · {row.createdAtIso}</span>
                <div className="muted" style={{ fontSize: "0.95rem" }}>
                  {accountActivityMetaLine(
                    row.workloadClass as LicensedVerifyOutcomeMetadata["workload_class"],
                    row.subcommand as LicensedVerifyOutcomeMetadata["subcommand"],
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: "1rem" }}>
          <Link href="/integrate" data-testid="account-primary-cta">
            Run verification (Integrate)
          </Link>
        </p>
      </section>

      <section
        data-testid="account-starter-upgrade"
        hidden={commercial.plan !== "starter"}
        style={{ marginTop: "1.25rem" }}
      >
        <h2 style={{ marginTop: 0 }}>Upgrade from Starter</h2>
        <p className="muted">
          Starter does not include paid CLI verification. Move to Individual, Team, or Business for
          quota-backed verification and CI features.
        </p>
        <p style={{ marginTop: "0.5rem" }}>
          <Link href="/pricing">View plans and upgrade</Link>
        </p>
      </section>

      <section data-testid="account-subscription-region" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ marginTop: 0 }}>Subscription</h2>
        {assertiveAccountMessage && (
          <LiveStatus mode="assertive">
            <p
              className="error-text"
              data-testid={
                portalErr && assertiveAccountMessage === portalErr
                  ? "billing-portal-error"
                  : "account-assertive-message"
              }
            >
              {assertiveAccountMessage}
            </p>
          </LiveStatus>
        )}
        <p>
          <strong>Plan:</strong> {commercial.plan}
        </p>
        <p>
          <strong>Subscription status:</strong> {commercial.subscriptionStatus}
        </p>
        <p title={billing.title}>
          <strong>Billing:</strong> {billing.label}
        </p>
        {commercial.hasStripeCustomer && (
          <p style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              data-testid="manage-billing-button"
              disabled={portalLoading}
              onClick={() => void openBillingPortal()}
            >
              {portalLoading ? "…" : "Manage billing"}
            </button>
          </p>
        )}
        {commercial.billingPriceSyncHint && (
          <div
            className="muted"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              border: "1px solid var(--muted)",
              borderRadius: "6px",
            }}
            data-testid="billing-price-sync-hint"
          >
            <p style={{ margin: 0 }}>
              <strong>Billing setup is still finishing.</strong> Your payment looks active, but we have not fully
              connected it to your plan yet. If this message stays after refreshing in a few minutes,{" "}
              {commercial.billingPriceSyncHint.supportEmail ? (
                <>
                  email{" "}
                  <a href={`mailto:${commercial.billingPriceSyncHint.supportEmail}`}>
                    {commercial.billingPriceSyncHint.supportEmail}
                  </a>{" "}
                  and include the address you use to sign in.
                </>
              ) : (
                <>use the contact options in the site footer.</>
              )}
            </p>
          </div>
        )}
        {showInactiveBillingCta && (
          <div
            className="muted"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              border: "1px solid var(--muted)",
              borderRadius: "6px",
            }}
            data-testid="inactive-subscription-notice"
          >
            <p style={{ margin: 0 }}>
              Your subscription is not active, so paid verification and enforcement are paused.
              {commercial.hasStripeCustomer
                ? " Use Manage billing above to update payment or your subscription, or choose a plan again from Pricing."
                : " Subscribe from Pricing to restore access."}
            </p>
            <p style={{ margin: "0.5rem 0 0" }}>
              <Link href="/pricing">View pricing and subscribe</Link>
            </p>
          </div>
        )}
        {checkout === "success" && expectedPlanRaw && (
          <div style={{ marginTop: "0.75rem" }}>
            {activationUi === "pending" && (
              <LiveStatus mode="polite">
                <p className="muted" data-testid="checkout-activation-pending">
                  {productCopy.account.checkoutActivationPending}
                </p>
              </LiveStatus>
            )}
            {activationUi === "ready" && (
              <LiveStatus mode="polite">
                <p style={{ color: "var(--muted)" }} data-testid="checkout-activation-ready">
                  {productCopy.account.checkoutActivationReady}
                </p>
              </LiveStatus>
            )}
          </div>
        )}
        <p style={{ marginTop: "0.75rem" }}>{commercial.entitlementSummary}</p>
      </section>

      <section data-testid="account-usage-region" style={{ marginTop: "1.25rem" }}>
        <div data-testid="account-monthly-quota">
          <h2 style={{ marginTop: 0 }}>{productCopy.account.monthlyQuotaHeading}</h2>
          <p className="muted">{productCopy.account.monthlyQuotaYearMonth(commercial.monthlyQuota.yearMonth)}</p>
          {commercial.monthlyQuota.keys.length === 0 ? (
            <p className="muted">No active API key. Create a key below to draw on your monthly quota.</p>
          ) : (
            commercial.monthlyQuota.keys.map((k) => (
              <p key={k.apiKeyId}>
                <strong>{k.label}:</strong>{" "}
                {productCopy.account.monthlyQuotaKeyLine(
                  k.used,
                  k.limit === null ? productCopy.account.monthlyQuotaUnlimited : String(k.limit),
                )}
              </p>
            ))
          )}
          <p className="muted">
            {productCopy.account.monthlyQuotaDistinctDays(commercial.monthlyQuota.distinctReserveUtcDaysThisMonth)}
          </p>
          <p data-testid="quota-urgency-line">
            {productCopy.account.quotaUrgencyCopy[commercial.monthlyQuota.worstUrgency]}
          </p>
        </div>
      </section>

      <section data-testid="account-api-key-region" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ marginTop: 0 }}>API key</h2>
        {(hasActiveKey || key) && (
          <p style={{ marginTop: "0.5rem" }}>
            <button type="button" onClick={() => void revokeKey()}>
              Revoke API key
            </button>
          </p>
        )}
        {!hasActiveKey && !key && (
          <button type="button" onClick={() => void createKey()}>
            Generate API key
          </button>
        )}
        {key ? (
          <>
            <LiveStatus mode="polite">
              <p className="muted">{productCopy.account.a11yApiKeyReady}</p>
            </LiveStatus>
            <p data-testid="api-key-plaintext" style={{ wordBreak: "break-all", marginTop: "0.75rem" }}>
              {key}
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={acknowledgeSavedKey}>
                I&apos;ve saved my key
              </button>
            </p>
          </>
        ) : null}
        <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.95rem" }}>
          Set <code>AGENTSKEPTIC_API_KEY</code> (legacy <code>WORKFLOW_VERIFIER_API_KEY</code> still works), then run{" "}
          <code style={{ wordBreak: "break-all" }}>npx agentskeptic verify …</code> from your repo.
        </p>
      </section>

      <section data-testid="account-trust-footnote" style={{ marginTop: "1.25rem" }}>
        <p className="muted" style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>
          {productCopy.account.trustFootnoteLines[0]}
        </p>
        <TrustFootnoteSecondLine text={productCopy.account.trustFootnoteLines[1]} />
      </section>
    </div>
  );
}
