"use client";

import { conversionSpine, productCopy } from "@/content/productCopy";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type RedeemOk = {
  schema_version: 1;
  run_id: string;
  terminal_status: string;
  workload_class: string;
  subcommand: string;
  build_profile: string;
  claimed_at: string;
};

type Phase = "ready" | "redeeming" | "redeemed" | "error" | "handoff_failed";

export function OssClaimClient() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("ready");
  const [summary, setSummary] = useState<RedeemOk | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handoffSupportId, setHandoffSupportId] = useState<string | null>(null);
  const redeemStarted = useRef(false);
  const urlErrorRead = useRef(false);

  useEffect(() => {
    if (urlErrorRead.current) return;
    const err = searchParams.get("error");
    if (err === "handoff_invalid") {
      urlErrorRead.current = true;
      setErrorMessage(productCopy.ossClaimPage.handoffInvalid);
      setPhase("error");
    } else if (err === "handoff_used") {
      urlErrorRead.current = true;
      setErrorMessage(productCopy.ossClaimPage.handoffUsed);
      setPhase("error");
    }
  }, [searchParams]);

  useEffect(() => {
    if (phase !== "ready" || status !== "authenticated" || redeemStarted.current) return;
    if (searchParams.get("error")) return;

    redeemStarted.current = true;
    setPhase("redeeming");

    void (async () => {
      try {
        const res = await fetch("/api/oss/claim-redeem", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const reqId = res.headers.get("x-request-id");
        const idSuffix = reqId ? ` Request ID: ${reqId}` : "";
        if (res.status === 200) {
          setSummary(data as RedeemOk);
          setPhase("redeemed");
          return;
        }
        if (
          res.status === 429 &&
          (data.code === "RATE_LIMITED" || data.code === "rate_limited")
        ) {
          setErrorMessage(`${productCopy.ossClaimPage.rateLimitedRedeem}${idSuffix}`);
          setPhase("error");
          return;
        }
        if (res.status === 409) {
          setErrorMessage(`${productCopy.ossClaimPage.alreadyClaimed}${idSuffix}`);
          setPhase("error");
          return;
        }
        if (
          res.status === 400 &&
          (data.code === "CLAIM_FAILED" ||
            data.code === "CLAIM_EXPIRED" ||
            data.code === "claim_failed")
        ) {
          setHandoffSupportId(reqId);
          setPhase("handoff_failed");
          return;
        }
        setErrorMessage(`${productCopy.ossClaimPage.claimFailed}${idSuffix}`);
        setPhase("error");
      } catch {
        setErrorMessage(productCopy.ossClaimPage.claimFailed);
        setPhase("error");
      }
    })();
  }, [phase, status, searchParams]);

  if (phase === "error" && errorMessage) {
    return (
      <div className="card card-narrow-32">
        <h1>{productCopy.ossClaimPage.title}</h1>
        <p>{errorMessage}</p>
        <Link className="button-link" href="/account">
          {productCopy.ossClaimPage.accountCta}
        </Link>
      </div>
    );
  }

  if (status === "loading") {
    return <p className="muted">{productCopy.ossClaimPage.redeeming}</p>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="card card-narrow-32">
        <h1>{productCopy.ossClaimPage.title}</h1>
        <p className="muted">{productCopy.ossClaimPage.introUnauthenticated}</p>
        <Link
          className="button-link"
          href="/auth/signin?callbackUrl=%2Fclaim"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ossClaimPage.signInCta}
        </Link>
      </div>
    );
  }

  if (phase === "redeeming" || (phase === "ready" && status === "authenticated")) {
    return <p className="muted">{productCopy.ossClaimPage.redeeming}</p>;
  }

  if (phase === "handoff_failed") {
    return (
      <div className="card card-narrow-32">
        <h1>{productCopy.ossClaimPage.title}</h1>
        <p>{productCopy.ossClaimPage.pendingHandoffMissing}</p>
        {handoffSupportId ? (
          <p className="muted try-it-request-id" data-testid="oss-claim-request-id">
            Request ID: {handoffSupportId}
          </p>
        ) : null}
        <Link
          className="button-link"
          href="/auth/signin?callbackUrl=%2Fclaim"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ossClaimPage.signInCta}
        </Link>
      </div>
    );
  }

  if (phase === "redeemed" && summary) {
    return (
      <div className="card card-narrow-32">
        <h1>{productCopy.ossClaimPage.title}</h1>
        <p>{productCopy.ossClaimPage.redeemedLead}</p>
        <p className="muted">{productCopy.ossClaimPage.runSummary(summary)}</p>
        <Link
          className="button-link"
          href={`/account?fromOssClaim=1&run_id=${encodeURIComponent(summary.run_id)}`}
        >
          {productCopy.ossClaimPage.accountCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="card card-narrow-32">
      <h1>{productCopy.ossClaimPage.title}</h1>
      <p className="muted">{productCopy.ossClaimPage.introUnauthenticated}</p>
    </div>
  );
}
