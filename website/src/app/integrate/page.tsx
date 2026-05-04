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
      <p className="lede">
        Run one verification that compares tool claims against actual stored state.
      </p>
      <p className="lede">Get a clear verdict before you ship, bill, or hand off to customers.</p>

      <h2>Contract truth check</h2>
      <p>
        Run <code>agentskeptic check</code> against your registry, events file, and database.
      </p>
      <ul>
        <li>
          <code>stderr</code> starts with <code>truth_check_verdict:</code>
        </li>
        <li>
          <code>stdout</code> returns the Outcome Certificate JSON
        </li>
        <li>
          Full guide:{" "}
          <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank">
            <code>docs/integrate.md</code>
          </a>
        </li>
      </ul>
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

      <h2>Requirements</h2>
      <ul>
        <li>Node.js 22 or newer</li>
        <li>Read-only database access</li>
        <li>Structured tool activity exported as NDJSON</li>
      </ul>

      <h2>What a green run shows</h2>
      <p>You&apos;ll see output like the bundled demo:</p>
      <ul>
        <li>
          <code>VERDICT: complete</code> + <code>trust: TRUSTED</code>
        </li>
        <li>Every step marked &quot;verified&quot; or &quot;matched&quot;</li>
      </ul>
      <p className="muted">
        If anything is wrong, verification fails immediately with an actionable reason such as <code>ROW_ABSENT</code>.
      </p>
      <p className="muted">No more silent green traces hiding bad data.</p>

      <h2>Next steps</h2>
      <ol>
        <li>
          <Link href="/verify">Try the interactive demo</Link>
        </li>
        <li>Run the command above on your own data</li>
        <li>
          <Link href="/guides">Follow the integration guides in Learn for deeper setup</Link>
        </li>
      </ol>
    </main>
  );
}
