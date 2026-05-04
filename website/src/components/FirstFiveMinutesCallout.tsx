"use client";

import firstFive from "@/content/first-five-minutes.json";
import Link from "next/link";
import "./FirstFiveMinutesCallout.css";

const FIRST_FIVE_MINUTES_CHECKLIST = firstFive.checklist;
const TELEMETRY_INTRO_PARAGRAPHS = firstFive.telemetryIntroParagraphs;

export type FirstFiveMinutesCalloutProps = {
  /** Shorter on `/` so policy detail does not interrupt the product story. */
  homeTeaser?: boolean;
};

/**
 * Shown only on routes where the funnel surface beacon fires
 * (same allowlist as `FunnelSurfaceBeacon`).
 */
export function FirstFiveMinutesCallout({ homeTeaser = false }: FirstFiveMinutesCalloutProps) {
  const introPs = TELEMETRY_INTRO_PARAGRAPHS.map((text) => (
    <p key={text} className="first-five-minutes-lede">
      {text}
    </p>
  ));

  if (homeTeaser) {
    return (
      <aside
        id="agentskeptic-first-five-minutes"
        className="first-five-minutes-callout first-five-minutes-callout--teaser muted"
        aria-label="First five minutes and optional telemetry"
      >
        <h2 className="first-five-minutes-callout-title">First five minutes</h2>
        <h3 className="first-five-minutes-privacy-note-heading">Privacy note</h3>
        {introPs}
        <p className="first-five-minutes-sub">
          <Link href="/privacy">Privacy policy</Link>
          {" · "}
          <span>Full setup: </span>
          <Link href="/integrate#agentskeptic-first-five-minutes">Get started</Link>
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
      <h3 className="first-five-minutes-privacy-note-heading">Privacy note</h3>
      {introPs}
      <p className="first-five-minutes-sub">
        <Link href="/privacy">Privacy policy</Link>
        {" · "}
        <span>Full setup: </span>
        <Link href="/integrate#agentskeptic-first-five-minutes">Get started</Link>
      </p>
      <details className="first-five-minutes-details">
        <summary>Telemetry and checklist details</summary>
        <p className="first-five-minutes-sub">What we may send on this page as an anonymous surface impression:</p>
        <ul className="first-five-minutes-list">
          <li>Surface label, such as acquisition or integrate</li>
          <li>Optional UTM fields</li>
          <li>Landing path</li>
          <li>Same-origin referrer path</li>
          <li>
            A pseudonymous <code>funnel_anon_id</code> UUID, if the server mints or confirms one
          </li>
        </ul>
        <p className="first-five-minutes-sub">No account email is sent in this beacon.</p>
        <p className="first-five-minutes-sub">What we do not do:</p>
        <ul className="first-five-minutes-list">
          <li>No cross-site third-party ad tracking</li>
          <li>No telemetry on non-allowlisted pages</li>
          <li>No telemetry that changes verification results</li>
        </ul>
        <p className="first-five-minutes-sub">
          If the beacon cannot mint an ID because of a blocked network or service issue, use:
        </p>
        <ul className="first-five-minutes-list">
          <li>
            <code>agentskeptic funnel-anon pull</code>
          </li>
          <li>
            <code>agentskeptic funnel-anon set &lt;uuid&gt;</code>
          </li>
        </ul>
        <p className="first-five-minutes-sub">To connect browser and CLI activity:</p>
        <ol className="first-five-minutes-numbered">
          {FIRST_FIVE_MINUTES_CHECKLIST.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <p className="first-five-minutes-sub">Telemetry never changes verification results.</p>
      </details>
    </aside>
  );
}
