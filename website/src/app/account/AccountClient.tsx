"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CommercialAccountStatePayload } from "@/lib/commercialAccountState";
import type { AccountPageVerificationActivity } from "@/lib/funnelObservabilityQueries";
import { LiveStatus } from "@/components/LiveStatus";
import { productCopy } from "@/content/productCopy";
import { accountAssertiveMessage } from "@/lib/accountAssertiveMessage";
import {
  STRIPE_CUSTOMER_MISSING_ERROR,
  STRIPE_CUSTOMER_MISSING_MESSAGE,
} from "@/lib/billingPortalConstants";
import { accountActivityMetaLine, accountActivityStatusLabel } from "@/lib/accountVerificationActivityUi";
import type { LicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";
import { SignOutButton } from "../SignOutButton";

type AccountApiKeyRow = {
  id: string;
  label: string;
  scopes: string[];
  status: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  disabledAt: string | null;
  lastUsedAt: string | null;
};

function ApiKeyOneTimeReveal({ apiKey, onAcknowledge }: { apiKey: string; onAcknowledge: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);

  async function copyKey() {
    setCopyErr(false);
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyErr(true);
    }
  }

  return (
    <>
      <LiveStatus mode="polite">
        <p className="muted">{productCopy.account.a11yApiKeyReady}</p>
      </LiveStatus>
      <p className="u-mt-085 u-mb-035">
        <strong>{productCopy.account.apiKeyRevealUrgentTitle}</strong>
      </p>
      <div className="account-api-key-reveal" data-testid="api-key-reveal-panel">
        <code data-testid="api-key-plaintext">{apiKey}</code>
        <button type="button" className="secondary" onClick={() => void copyKey()}>
          {copied ? productCopy.account.apiKeyCopyButtonCopied : productCopy.account.apiKeyCopyButton}
        </button>
      </div>
      {copyErr ? (
        <p className="muted u-mt-04 u-fs-09">
          {productCopy.account.apiKeyCopyFallback}
        </p>
      ) : null}
      <p className="u-mt-085">
        <button type="button" onClick={onAcknowledge}>
          I&apos;ve saved my key
        </button>
      </p>
    </>
  );
}

function billingUnmappedNotice(): { label: string; title: string } {
  return {
    label: "We're still connecting your subscription to the right plan in billing.",
    title: "This is usually temporary after checkout or a plan change. If it persists, use Manage billing or contact support.",
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
  initialKeys,
  hasKey,
  initialCommercial,
  activity,
}: {
  initialKeys?: AccountApiKeyRow[];
  hasKey?: boolean;
  initialCommercial: CommercialAccountStatePayload;
  activity: AccountPageVerificationActivity;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const expectedPlanRaw = searchParams.get("expectedPlan");
  const fromOssClaim = searchParams.get("fromOssClaim") === "1";
  const ossClaimRunId = searchParams.get("run_id")?.trim() ?? "";

  const [newlyIssuedKey, setNewlyIssuedKey] = useState<string | null>(null);
  const seedKeys = initialKeys ?? (hasKey ? [{
    id: "legacy-single-key",
    label: "API key",
    scopes: ["read", "meter", "report", "admin"],
    status: "active",
    createdAt: new Date(0).toISOString(),
    expiresAt: null,
    revokedAt: null,
    disabledAt: null,
    lastUsedAt: null,
  }] : []);
  const [keyRows, setKeyRows] = useState<AccountApiKeyRow[]>(seedKeys);
  const [err, setErr] = useState<string | null>(null);
  const [commercial, setCommercial] = useState<CommercialAccountStatePayload>(initialCommercial);
  const [activationUi, setActivationUi] = useState<"idle" | "pending" | "ready" | "timeout">("idle");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalErr, setPortalErr] = useState<string | null>(null);

  const checkoutRefreshKeyRef = useRef<string | null>(null);

  const billingUnmapped = billingUnmappedNotice();

  const monthCount =
    activity.ok === true ? activity.licensedOutcomesThisUtcMonth : 0;

  useEffect(() => {
    setCommercial(initialCommercial);
  }, [initialCommercial]);

  useEffect(() => {
    const nextKeys = initialKeys ?? (hasKey ? [{
      id: "legacy-single-key",
      label: "API key",
      scopes: ["read", "meter", "report", "admin"],
      status: "active",
      createdAt: new Date(0).toISOString(),
      expiresAt: null,
      revokedAt: null,
      disabledAt: null,
      lastUsedAt: null,
    }] : []);
    setKeyRows(nextKeys);
  }, [initialKeys, hasKey]);

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

  const hasActiveKey = keyRows.some((k) => k.status === "active");

  async function refreshKeys() {
    const r = await fetch("/api/account/keys");
    if (!r.ok) return;
    const j = (await r.json()) as { keys?: AccountApiKeyRow[] };
    setKeyRows(j.keys ?? []);
  }

  async function createKey() {
    setErr(null);
    const defaultLabel = `Key ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const label = window.prompt("Label for this key", defaultLabel)?.trim();
    if (!label) return;
    const r = await fetch("/api/account/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        scopes: ["read", "meter", "report", "admin"],
      }),
    });
    const j = (await r.json()) as { key?: { id: string; apiKey: string }; error?: string };
    if (!r.ok) {
      setErr(j.error ?? "Failed");
      return;
    }
    if (j.key?.apiKey) {
      setNewlyIssuedKey(j.key.apiKey);
      await refreshKeys();
    }
  }

  async function revokeKey(keyId: string) {
    if (
      !window.confirm(
        "Revoke this API key? Any integration using it will stop immediately.",
      )
    ) {
      return;
    }
    setErr(null);
    const r = await fetch(`/api/account/keys/${encodeURIComponent(keyId)}/revoke`, { method: "POST" });
    const j = (await r.json()) as { ok?: boolean; revoked?: boolean; error?: string };
    if (r.status === 401) {
      setErr(j.error ?? "Unauthorized");
      return;
    }
    if (!r.ok || !j.ok) {
      setErr("Revoke failed");
      return;
    }
    setNewlyIssuedKey(null);
    await refreshKeys();
  }

  async function rotateKey(keyId: string) {
    if (!window.confirm("Rotate this key now? The current key will be revoked.")) {
      return;
    }
    setErr(null);
    const r = await fetch(`/api/account/keys/${encodeURIComponent(keyId)}/rotate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = (await r.json()) as { key?: { id: string; apiKey: string }; error?: string };
    if (!r.ok || !j.key?.apiKey) {
      setErr(j.error ?? "Rotate failed");
      return;
    }
    setNewlyIssuedKey(j.key.apiKey);
    await refreshKeys();
  }

  function acknowledgeSavedKey() {
    setNewlyIssuedKey(null);
    router.refresh();
  }

  const showInactiveBillingCta = commercial.subscriptionStatus === "inactive";

  const assertiveAccountMessage = accountAssertiveMessage(portalErr, err, activationUi);

  const latestRow = activity.ok === true && activity.rows[0] ? activity.rows[0] : null;
  const showExactEmpty =
    activity.ok === true &&
    activity.rows.length === 0 &&
    activity.licensedOutcomesThisUtcMonth === 0;
  const hasActivityRows = activity.ok === true && activity.rows.length > 0;
  const showMonthCountNoRows =
    activity.ok === true &&
    activity.rows.length === 0 &&
    activity.licensedOutcomesThisUtcMonth > 0;
  const showMetricLine =
    activity.ok === true && (hasActivityRows || (!showExactEmpty && monthCount > 0));

  const noQuotaConsumptionThisMonth =
    commercial.monthlyQuota.distinctReserveUtcDaysThisMonth === 0 &&
    (commercial.monthlyQuota.keys.length === 0 ||
      commercial.monthlyQuota.keys.every((k) => k.used === 0));
  const quotaUrgencyLine =
    commercial.monthlyQuota.worstUrgency === "ok" && noQuotaConsumptionThisMonth
      ? productCopy.account.quotaUrgencyZeroUsage
      : productCopy.account.quotaUrgencyCopy[commercial.monthlyQuota.worstUrgency];

  return (
    <div className="card u-mt-1">
      <p className="u-mt-0 u-mb-1">
        <SignOutButton variant="account" />
      </p>

      {fromOssClaim ? (
        <div className="card u-mb-1" data-testid="oss-claim-account-checklist">
          <h2 className="u-mt-0">{productCopy.account.ossClaimChecklistTitle}</h2>
          <ul className="u-mt-05">
            {productCopy.account.ossClaimChecklistItems.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {ossClaimRunId ? (
            <p className="muted u-mt-05" data-testid="oss-claim-run-hint">
              {productCopy.account.ossClaimRunHint(ossClaimRunId)}
            </p>
          ) : null}
          {commercial.plan === "starter" ? (
            <p className="u-mt-1">
              <Link className="button-link" href="/pricing" data-testid="starter-cta-pricing">
                {productCopy.account.ossClaimStarterCta}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <section data-testid="account-verification-region">
        <h2 className="u-mt-0">Verification</h2>
        {activity.ok === false ? (
          <>
            <p>
              <strong>{productCopy.account.verificationHeadlineLoadFailed}</strong>
            </p>
            <p className="muted" data-testid="account-activity-error">
              {productCopy.account.activityLoadError}
            </p>
          </>
        ) : showExactEmpty ? (
          <p>
            <strong>{productCopy.account.verificationHeadlineEmpty}</strong>
          </p>
        ) : hasActivityRows ? (
          <>
            <p>
              <strong>{productCopy.account.verificationHeadlineHasRows}</strong>
            </p>
            {latestRow ? (
              <p className="muted">
                <strong>Latest:</strong> {statusLabelFromRow(latestRow)} ·{" "}
                {accountActivityMetaLine(
                  latestRow.workloadClass as LicensedVerifyOutcomeMetadata["workload_class"],
                  latestRow.subcommand as LicensedVerifyOutcomeMetadata["subcommand"],
                )}
              </p>
            ) : null}
          </>
        ) : showMonthCountNoRows ? (
          <>
            <p>
              <strong>{productCopy.account.verificationHeadlineHasRows}</strong>
            </p>
            <p className="muted">{productCopy.account.verificationMonthNoRowsDetail}</p>
          </>
        ) : (
          <p>
            <strong>{productCopy.account.verificationHeadlineEmpty}</strong>
          </p>
        )}
        {showMetricLine ? (
          <p className="muted u-mt-035">
            {productCopy.account.verificationMetricLine(monthCount)}
          </p>
        ) : null}
        {activity.ok === true && !showExactEmpty && hasActivityRows ? (
          <ul className="account-activity-list">
            {activity.rows.map((row) => (
              <li key={row.createdAtIso} className="account-activity-li">
                <span>{statusLabelFromRow(row)}</span>
                <span className="muted"> · {row.createdAtIso}</span>
                <div className="muted account-activity-meta">
                  {accountActivityMetaLine(
                    row.workloadClass as LicensedVerifyOutcomeMetadata["workload_class"],
                    row.subcommand as LicensedVerifyOutcomeMetadata["subcommand"],
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="u-mt-1">
          <Link href="/integrate" className="btn" data-testid="account-primary-cta">
            {hasActivityRows || monthCount > 0
              ? productCopy.account.primaryVerificationCtaAgain
              : productCopy.account.primaryVerificationCtaFirstRun}
          </Link>
        </p>
      </section>

      <section data-testid="account-subscription-region" className="u-mt-125">
        <h2 className="u-mt-0">Subscription</h2>
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
        {commercial.priceMapping === "unmapped" ? (
          <p className="muted" title={billingUnmapped.title}>
            <strong>Billing:</strong> {billingUnmapped.label}
          </p>
        ) : null}
        {commercial.hasStripeCustomer && (
          <p className="u-mt-05">
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
          <div className="muted account-muted-callout" data-testid="billing-price-sync-hint">
            <p className="u-m-0">
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
          <div className="muted account-muted-callout" data-testid="inactive-subscription-notice">
            <p className="u-m-0">
              Your subscription is not active, so paid verification and enforcement are paused.
              {commercial.hasStripeCustomer
                ? " Use Manage billing above to update payment or your subscription, or choose a plan again from Pricing."
                : " Subscribe from Pricing to restore access."}
            </p>
            <p className="u-mt-05-first">
              <Link href="/pricing">View pricing and subscribe</Link>
            </p>
          </div>
        )}
        {checkout === "success" && expectedPlanRaw && (
          <div className="u-mt-075">
            {activationUi === "pending" && (
              <LiveStatus mode="polite">
                <p className="muted" data-testid="checkout-activation-pending">
                  {productCopy.account.checkoutActivationPending}
                </p>
              </LiveStatus>
            )}
            {activationUi === "ready" && (
              <LiveStatus mode="polite">
                <p className="muted" data-testid="checkout-activation-ready">
                  {productCopy.account.checkoutActivationReady}
                </p>
              </LiveStatus>
            )}
          </div>
        )}
        {commercial.plan !== "starter" ? (
          <p className="u-mt-075">{commercial.entitlementSummary}</p>
        ) : null}
      </section>

      <section data-testid="account-usage-region" className="u-mt-125">
        <div data-testid="account-monthly-quota">
          <h2 className="u-mt-0">{productCopy.account.monthlyQuotaHeading}</h2>
          <p className="muted" data-testid="quota-reset-date">
            Resets at {commercial.monthlyQuota.periodEndUtc}
          </p>
          {commercial.monthlyQuota.keys.length === 0 ? (
            <p className="muted">{productCopy.account.monthlyQuotaNoKeyLine}</p>
          ) : (
            commercial.monthlyQuota.keys.map((k) => (
              <p key={k.apiKeyId}>
                <strong>{k.label}:</strong>{" "}
                {productCopy.account.monthlyQuotaKeyLine(
                  k.used,
                  k.limit === null ? productCopy.account.monthlyQuotaUnlimited : String(k.limit),
                )}
                {k.overageOnKey > 0 ? (
                  <span className="muted"> — {k.overageOnKey.toLocaleString()} overage (metered)</span>
                ) : null}
              </p>
            ))
          )}
          {commercial.monthlyQuota.overageProjectedLine ? (
            <p className="muted" data-testid="overage-projected">
              {commercial.monthlyQuota.overageProjectedLine}
            </p>
          ) : null}
          {commercial.monthlyQuota.overageUpgradeNudge ? (
            <p className="muted" data-testid="overage-nudge">
              {commercial.monthlyQuota.overageUpgradeNudge}
            </p>
          ) : null}
          {commercial.monthlyQuota.worstUrgency === "ok" && noQuotaConsumptionThisMonth ? null : (
            <p data-testid="quota-urgency-line">{quotaUrgencyLine}</p>
          )}
        </div>
      </section>

      <section data-testid="account-api-key-region" className="u-mt-125">
        <h2 className="u-mt-0">API key</h2>
        <p className="muted u-mt-025">
          Generate an API key below. Copy it immediately; it is shown once.
        </p>
        <p className="u-mt-05">
          <button type="button" onClick={() => void createKey()}>
            Generate API key
          </button>
        </p>
        {keyRows.length > 0 ? (
          <ul className="u-mt-05">
            {keyRows.map((k) => (
              <li key={k.id} className="u-mb-05">
                <strong>{k.label}</strong> — {k.status} — scopes: {k.scopes.join(", ")}
                {k.lastUsedAt ? <span className="muted"> · last used {k.lastUsedAt}</span> : null}
                {k.status === "active" ? (
                  <>
                    {" "}
                    <button type="button" onClick={() => void revokeKey(k.id)}>
                      Revoke
                    </button>{" "}
                    <button type="button" onClick={() => void rotateKey(k.id)}>
                      Rotate
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {newlyIssuedKey ? <ApiKeyOneTimeReveal apiKey={newlyIssuedKey} onAcknowledge={acknowledgeSavedKey} /> : null}
      </section>
    </div>
  );
}
