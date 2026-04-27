"use client";

import {
  FIRST_FIVE_MINUTES_CHECKLIST,
  TELEMETRY_ICING_LINE,
} from "agentskeptic/firstFiveMinutesChecklist";
import Link from "next/link";
import "./FirstFiveMinutesCallout.css";

export type FirstFiveMinutesCalloutProps = {
  /** Shorter on `/` so policy detail does not interrupt the product story. */
  homeTeaser?: boolean;
};

/**
 * Shown only on routes where the funnel surface beacon fires
 * (same allowlist as `FunnelSurfaceBeacon`).
 */
export function FirstFiveMinutesCallout({ homeTeaser = false }: FirstFiveMinutesCalloutProps) {
  if (homeTeaser) {
    return (
      <aside
        id="agentskeptic-first-five-minutes"
        className="first-five-minutes-callout first-five-minutes-callout--teaser muted"
        aria-label="First five minutes and optional telemetry"
      >
        <h2 className="first-five-minutes-callout-title">First five minutes</h2>
        <p className="first-five-minutes-lede">{TELEMETRY_ICING_LINE}</p>
        <p className="first-five-minutes-sub">
          <Link href="/privacy">Privacy policy</Link>
          {" · "}
          <Link href="/integrate#agentskeptic-first-five-minutes">Get started: full checklist and CLI</Link>
        </p>
      </aside>
    );
  }

  return (
    <aside
      id="agentskeptic-first-five-minutes"
      className="first-five-minutes-callout muted"
      aria-label="First five minutes and anonymous telemetry"
    >
      <h2 className="first-five-minutes-callout-title">First five minutes</h2>
      <p className="first-five-minutes-lede">{TELEMETRY_ICING_LINE}</p>
      <p className="first-five-minutes-sub">
        Privacy details: <Link href="/privacy">Privacy policy</Link> · full setup:{" "}
        <Link href="/integrate#agentskeptic-first-five-minutes">Get started</Link>.
      </p>
      <details className="first-five-minutes-details">
        <summary>Telemetry and checklist details</summary>
        <p className="first-five-minutes-sub">What we may send on this page (anonymous surface impression):</p>
        <ul className="first-five-minutes-list">
          <li>Surface label (acquisition vs integrate), optional UTM fields, landing path, same-origin referrer path.</li>
          <li>
            A pseudonymous funnel_anon_id (UUID) after the server mints or confirms one — no account email in this
            beacon.
          </li>
        </ul>
        <p className="first-five-minutes-sub">What we do not do here:</p>
        <ul className="first-five-minutes-list">
          <li>No cross-site third-party ad tracking; allowlisted pages only (see site policy docs).</li>
        </ul>
        <p className="first-five-minutes-sub">
          If the beacon could not mint an id (blocked network, 503 freeze), use{" "}
          <code>agentskeptic funnel-anon pull</code> or <code>agentskeptic funnel-anon set &lt;uuid&gt;</code> from a
          browser-issued id.
        </p>
        <ol className="first-five-minutes-numbered">
          {FIRST_FIVE_MINUTES_CHECKLIST.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </details>
    </aside>
  );
}
