import { MarketingCodeBlock } from "@/components/marketing/MarketingCodeBlock";
import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import marketing from "@/lib/marketing";
import {
  INTEGRATE_DOC_REL_AMBIENT_CI,
  INTEGRATE_DOC_REL_COVERAGE_BUDGETS,
  IntegrateAdoptionLadderSections,
} from "@/content/integrateAdoptionCopy";
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
  const githubBlob = (rel: string) => `${marketing.gitRepositoryUrl}/blob/main/${rel}`;
  return (
    <MarketingPageShell variant="documentProse" data-testid="integrate-page">
      <MarketingPageHeader
        title={siteMetadata.integrate.title}
        description={
          <>
            <p className="lede">{siteMetadata.integrate.description}</p>
            <p className="lede">Get a deterministic verdict before you ship, bill, or hand off to customers.</p>
          </>
        }
      />

      <IntegrateAdoptionLadderSections
        coverageBudgetsHref={githubBlob(INTEGRATE_DOC_REL_COVERAGE_BUDGETS)}
        ambientCiHref={githubBlob(INTEGRATE_DOC_REL_AMBIENT_CI)}
      />

      <h2 id="first-truth-check">First proof: contract truth check</h2>
      <p>
        Run <code>agentskeptic check</code> against your registry, events file, and readable verification targets (database for SQL; remote URL for HTTP / object / vector / Mongo witnesses per registry).
      </p>
      <p>A successful run gives you:</p>
      <ul>
        <li>
          <code>stderr</code> beginning with the two machine lines <code>truth_check_verdict:</code> and{" "}
          <code>release_critical_truth_check_verdict:</code>
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
      <p>
        <strong>Hybrid contract demo (SQL + HTTP witness):</strong>{" "}
        <a
          href={`${marketing.gitRepositoryUrl}/blob/main/examples/hybrid-contract-demo.mjs`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <code>examples/hybrid-contract-demo.mjs</code>
        </a>{" "}
        (requires <code>npm run build</code> and <code>POSTGRES_VERIFICATION_URL</code>).
      </p>
      <MarketingCodeBlock id="integrate-truth-check-commands" data-testid="integrate-truth-check-commands">
        {p.truthCheckCommand}
      </MarketingCodeBlock>
      <p className="home-cta-row">
        <Link
          className="btn"
          href="/verify"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {conversionSpine.dominantByRoute["/integrate"]}
        </Link>
      </p>

      <h2>Before you run it</h2>
      <p>You need:</p>
      <ul>
        <li>Node.js 22 or newer</li>
        <li>
          read-only access to verification targets you configure (database for SQL steps; witness URLs and credentials for
          HTTP, object, vector, or Mongo per registry)
        </li>
        <li>structured tool activity exported as NDJSON</li>
      </ul>
      <p className="muted">
        Learn guides include Next.js and Postgres paths alongside SQLite snapshots.
      </p>

      <h2>Reading the verdict</h2>
      <p>
        On verdict exits, <code>stderr</code> starts with two automation lines —{" "}
        <code>truth_check_verdict: trusted|not_trusted|unknown</code> and{" "}
        <code>release_critical_truth_check_verdict: trusted|not_trusted|unknown</code> (see{" "}
        <a href={`${marketing.gitRepositoryUrl}/blob/main/docs/first-truth-check.md`} rel="noopener noreferrer" target="_blank">
          <code>docs/first-truth-check.md</code>
        </a>
        ). When an opt-in coverage budget policy is active, two additional machine lines follow the truth lines — see{" "}
        <a href={`${marketing.gitRepositoryUrl}/blob/main/docs/integrate.md#optional-coverage-budgets`} rel="noopener noreferrer" target="_blank">
          <code>docs/integrate.md</code> (optional coverage budgets)
        </a>
        . The human-readable report below those lines may include engine phrases for each step; the first truth line is the
        primary gate for whether you can rely on the global workflow outcome.
      </p>
      <table className="integrate-verdict-table" aria-label="Truth check verdict and next action">
        <thead>
          <tr>
            <th scope="col">
              <code>truth_check_verdict</code>
            </th>
            <th scope="col">Next action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>trusted</code>
            </td>
            <td>
              Proceed with reliance only when your policy allows (the certificate must still show expected state
              matched). Do not claim verified if anything else disagrees with this line.
            </td>
          </tr>
          <tr>
            <td>
              <code>not_trusted</code>
            </td>
            <td>
              Block handoff, ship, bill, or continuation on this run—fix the workflow, data, or registry expectation and
              re-run <code>check</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>unknown</code>
            </td>
            <td>
              Do not claim verified—add observations, witnesses, or narrow scope until the verdict can be determined.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="muted">
        If stored state is wrong, you get <code>not_trusted</code> with an actionable reason such as{" "}
        <code>ROW_ABSENT</code> in the report.
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
    </MarketingPageShell>
  );
}
