import marketing from "@/lib/marketing";
import { conversionSpine } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const integrateSocialTitle = brandedMarketingTitle(siteMetadata.integrate.title);

export const metadata: Metadata = {
  title: siteMetadata.integrate.title,
  description: siteMetadata.integrate.description,
  alternates: { canonical: indexableGuideCanonical("/integrate") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({
    title: integrateSocialTitle,
    description: siteMetadata.integrate.description,
  }),
};

export default function IntegratePage() {
  const p = marketing.integratePage;
  return (
    <main className="integrate-main integrate-prose" data-testid="integrate-page">
      <h1>{siteMetadata.integrate.title}</h1>
      <p className="lede">{siteMetadata.integrate.description}</p>
      <p className="lede">
        Get a deterministic verdict before you ship, bill, or hand off to customers.
      </p>

      <h2>First proof: contract truth check</h2>
      <p>
        Run <code>agentskeptic check</code> against your registry, events file, and readable database.
      </p>
      <p>A successful run gives you:</p>
      <ul>
        <li>
          <code>stderr</code> beginning with <code>truth_check_verdict:</code>
        </li>
        <li>
          <code>stdout</code> containing the Outcome Certificate JSON
        </li>
        <li>a reusable path for local verification and CI</li>
      </ul>
      <p>
        Full guide:{" "}
        <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank">
          <code>docs/integrate.md</code>
        </a>
      </p>
      <pre
        id="integrate-truth-check-commands"
        className="integrate-pack-command"
        data-testid="integrate-truth-check-commands"
      >
        {p.truthCheckCommand}
      </pre>
      <p className="home-cta-row">
        <a
          className="btn"
          href="#integrate-truth-check-commands"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {conversionSpine.dominantByRoute["/integrate"]}
        </a>
      </p>

      <h2>Before you run it</h2>
      <p>You need:</p>
      <ul>
        <li>Node.js 22 or newer</li>
        <li>read-only access to the database or snapshot you want to verify</li>
        <li>structured tool activity exported as NDJSON</li>
      </ul>
      <p className="muted">
        Learn guides include Next.js and Postgres paths alongside SQLite snapshots.
      </p>

      <h2>What a green run proves</h2>
      <p>
        A green run means AgentSkeptic re-read the configured store and found the expected state.
      </p>
      <p>You should see:</p>
      <ul>
        <li>
          <code>VERDICT: complete</code>
        </li>
        <li>
          <code>trust: TRUSTED</code>
        </li>
        <li>
          every relevant step marked <code>verified</code> or <code>matched</code>
        </li>
      </ul>
      <p className="muted">
        If stored state is wrong, verification fails immediately with an actionable reason such as{" "}
        <code>ROW_ABSENT</code>.
      </p>
      <p className="muted">No more silent green traces hiding bad data.</p>

      <h2>Next steps</h2>
      <ol>
        <li>
          <Link href="/verify">Try the interactive demo to see a missing-write failure.</Link>
        </li>
        <li>Run the command above against your own readable data.</li>
        <li>
          <Link href="/guides">Follow the Learn guides to wire the same check into CI.</Link>
        </li>
      </ol>
    </main>
  );
}
