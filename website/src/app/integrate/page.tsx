import { loadBuyerTruth } from "@/lib/buyerTruth";
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
  const requirements = loadBuyerTruth().integrateRequirements;
  return (
    <main className="integrate-main integrate-prose" data-testid="integrate-page">
      <h1>{siteMetadata.integrate.title}</h1>
      <section
        className="integrate-registry-draft-secondary"
        data-testid="integrate-guided-cta"
        aria-label="Guided first verification"
      >
        <p className="lede">
          <strong>Optional guided drafting:</strong>{" "}
          <Link className="btn" href="/integrate/guided" data-testid="integrate-guided-link">
            Guided: generate registry and quick input
          </Link>{" "}
          — generate artifacts quickly, then follow the canonical Next.js + Postgres golden path for production onboarding.
        </p>
      </section>
      <p className="lede integrate-benefit-lede">
        <strong>{siteMetadata.integrate.description}</strong>
      </p>
      <p className="lede">
        Run a single verification that compares what your agents and tools claimed against your actual stored state.
      </p>
      <p className="lede">Get a clear, binary verdict before you ship, bill, or hand off to customers.</p>
      <p className="lede">
        <strong>Golden path:</strong> Next.js (App Router) + Postgres. Use the executable{" "}
        <a href="https://github.com/jwekavanagh/agentskeptic/blob/main/docs/golden-path.md" rel="noopener noreferrer" target="_blank">
          golden-path.md
        </a>{" "}
        and reference app for first-run onboarding.
      </p>
      <p className="home-cta-row">
        <a
          className="btn"
          href="#integrate-crossing-commands"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {conversionSpine.dominantByRoute["/integrate"]}
        </a>
      </p>
      <p className="lede muted">
        <Link href="#agentskeptic-first-five-minutes">First five minutes</Link> — anonymous id (browser where applicable),
        CLI join, verify, and
        optional telemetry (same checklist appears at the top of beacon-eligible pages).
      </p>

      <h2>Activate to proof (canonical)</h2>
      <p>
        Use <code>agentskeptic activate</code> with BootstrapPackInput v1 JSON and your database URL. It progresses through
        provisional inference, contract verification, and writes exportable bundles under <code>proof/</code> in your{" "}
        <code>--out</code> directory (<code>run/</code>, <code>decision/</code>). For replay-only flows when you already have{" "}
        <code>events.ndjson</code> and <code>tools.json</code>, see <code>agentskeptic crossing</code> below.
      </p>
      <pre id="integrate-crossing-commands" className="integrate-pack-command" data-testid="integrate-crossing-commands">
        {p.packLedCommand}
      </pre>
      <p>
        <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank" data-testid="integrate-gh-deep-link">
          Integrator SSOT
        </a>
      </p>
      <p>
        What <code>agentskeptic activate</code> does:
      </p>
      <ul>
        <li>Loads your BootstrapPackInput v1 JSON and a readable SQLite or Postgres URL.</li>
        <li>Runs provisional inference (read-only SQL), synthesizes the contract pack, then replays full contract verification.</li>
        <li>
          On contract termination (exit <code>0</code>, <code>1</code>, or <code>2</code>), writes exportable bundles under{" "}
          <code>proof/run</code>, <code>proof/decision</code>, and <code>proof/activation.manifest.json</code> inside{" "}
          <code>--out</code>.
        </li>
      </ul>
      <p>
        Success = <code>exit 0</code> with <code>VERDICT: complete</code> and <code>trust: TRUSTED</code>. For{" "}
        <code>agentskeptic activate</code>, exit <code>0</code> pairs with <code>trustTerminal=decision_ready</code> in{" "}
        <code>proof/activation.manifest.json</code>; exits <code>1</code>/<code>2</code> still retain <code>proof/</code> with{" "}
        <code>contract_inconsistent</code> or <code>contract_incomplete</code>. <code>agentskeptic crossing</code> behavior is
        unchanged.
      </p>
      <p className="muted">
        Failure surfaces explicit issues like <code>ROW_ABSENT</code> instead of letting silent gaps reach production.
      </p>

      <h2>Requirements</h2>
      <ul>
        {requirements.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h2>Product completion: wire your emitters</h2>
      <p>
        Wire tool and workflow code so it emits the NDJSON and registry verification consumes. Product completion is your
        emitters and stores matching the expected shape — not a long shell template.
      </p>

      <h2>What a green run shows</h2>
      <p>You&apos;ll see output like the bundled demo:</p>
      <ul>
        <li>
          <code>VERDICT: complete</code> + <code>trust: TRUSTED</code>
        </li>
        <li>Every step marked &quot;verified&quot; or &quot;matched&quot;</li>
      </ul>
      <p className="muted">
        If anything is wrong, you get an immediate, actionable failure (e.g. <code>ROW_ABSENT</code>) — no more
        silent green traces hiding bad data.
      </p>

      <section
        className="integrate-optional-spine integrate-framework-picker"
        aria-label="Framework starter commands"
        id="agentskeptic-init"
      >
        <h3>Framework starter (`init`)</h3>
        <p className="muted">
          AgentSkeptic v2 has one fully-supported onboarding stack: Next.js + Postgres. Commands below are local
          contract-based bootstrap helpers. Full integrator SSOT:{" "}
          <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank">
            docs/integrate.md
          </a>
          .
        </p>
        <p>
          <strong>TypeScript · Next.js (App Router)</strong>
        </p>
        <pre
          className="integrate-pack-command"
          data-testid="integrator-activation-commands"
        >{`npx agentskeptic init --framework next --database sqlite --yes`}</pre>
        <p>
          <strong>TypeScript · bare</strong>
        </p>
        <pre className="integrate-pack-command">{`npx agentskeptic init --framework none --database sqlite --yes`}</pre>
        <p>
          <strong>Python</strong>
        </p>
        <pre className="integrate-pack-command">{`python -m agentskeptic init --framework none --database sqlite --yes`}</pre>
      </section>

      <h2>Next steps</h2>
      <ol>
        <li>
          <Link href="/verify">Try the interactive demo</Link> (no account required)
        </li>
        <li>Run the command above on your own data</li>
        <li>
          <Link href="/guides">Follow the integration guides in Learn</Link> for deeper setup
        </li>
      </ol>

      <h2>Full documentation</h2>
      <p>
        <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank">
          Integrator SSOT
        </a>{" "}
        ·{" "}
        <a href={p.githubFirstRunLink} rel="noopener noreferrer" target="_blank" data-testid="integrate-gh-first-run">
          First-run integration
        </a>{" "}
        · <Link href="/guides">Learn hub</Link> · <Link href="/pricing">Pricing</Link>
      </p>
    </main>
  );
}
