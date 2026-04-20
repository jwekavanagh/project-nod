"use client";

import { productCopy } from "@/content/productCopy";
import Link from "next/link";
import { useSession } from "next-auth/react";
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

type Phase =
  | "init"
  | "stash_error"
  | "ready"
  | "redeeming"
  | "redeemed"
  | "error"
  | "handoff_failed";

export function OssClaimClient() {
  const { status } = useSession();
  const [phase, setPhase] = useState<Phase>("init");
  const [summary, setSummary] = useState<RedeemOk | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stashStarted = useRef(false);
  const redeemStarted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || stashStarted.current) return;
    const hash = window.location.hash;
    if (hash.length <= 1) {
      setPhase("ready");
      return;
    }
    const raw = hash.slice(1);
    let secret: string;
    try {
      secret = decodeURIComponent(raw);
    } catch {
      secret = raw;
    }
    if (!/^[0-9a-f]{64}$/i.test(secret)) {
      setPhase("ready");
      return;
    }
    stashStarted.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/oss/claim-pending", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ claim_secret: secret.toLowerCase() }),
          credentials: "include",
        });
        if (res.status === 429) {
          setErrorMessage(productCopy.ossClaimPage.rateLimitedClaimPending);
          setPhase("stash_error");
          return;
        }
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setPhase("ready");
      } catch {
        setErrorMessage(productCopy.ossClaimPage.claimFailed);
        setPhase("stash_error");
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "ready" || status !== "authenticated" || redeemStarted.current) return;
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
        if (res.status === 200) {
          setSummary(data as RedeemOk);
          setPhase("redeemed");
          return;
        }
        if (res.status === 429 && data.code === "rate_limited") {
          setErrorMessage(productCopy.ossClaimPage.rateLimitedRedeem);
          setPhase("error");
          return;
        }
        if (res.status === 409) {
          setErrorMessage(productCopy.ossClaimPage.alreadyClaimed);
          setPhase("error");
          return;
        }
        if (res.status === 400 && data.code === "claim_failed") {
          setPhase("handoff_failed");
          return;
        }
        setErrorMessage(productCopy.ossClaimPage.claimFailed);
        setPhase("error");
      } catch {
        setErrorMessage(productCopy.ossClaimPage.claimFailed);
        setPhase("error");
      }
    })();
  }, [phase, status]);

  if (phase === "init") {
    return <p className="muted">{productCopy.ossClaimPage.redeeming}</p>;
  }

  if (phase === "stash_error" && errorMessage) {
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
        <Link className="button-link" href="/auth/signin?callbackUrl=%2Fclaim">
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
        <Link className="button-link" href="/auth/signin?callbackUrl=%2Fclaim">
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
        <Link className="button-link" href="/account">
          {productCopy.ossClaimPage.accountCta}
        </Link>
      </div>
    );
  }

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

  return (
    <div className="card card-narrow-32">
      <h1>{productCopy.ossClaimPage.title}</h1>
      <p className="muted">{productCopy.ossClaimPage.introUnauthenticated}</p>
    </div>
  );
}
