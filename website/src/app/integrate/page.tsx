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
        <Link href="#agentskeptic-first-five-minutes">First five minutes</Link> — browser id, CLI join, verify, and
        optional telemetry (same checklist appears at the top of beacon-eligible pages).
      </p>

      <h2>Scaffold then verify (canonical v2 path)</h2>
      <p>
        Run <code>agentskeptic init</code> to emit <code>agentskeptic/tools.json</code>, <code>agentskeptic/events.ndjson</code>,
        and a seeded <code>demo.db</code>, then add the documented <code>verify</code> script. For pack-led NDJSON replay
        without scaffolding, see <code>agentskeptic crossing</code> in{" "}
        <a href="https://github.com/jwekavanagh/agentskeptic/blob/main/docs/crossing-normative.md" rel="noopener noreferrer" target="_blank">
          crossing-normative.md
        </a>
        .
      </p>
      <pre id="integrate-crossing-commands" className="integrate-pack-command" data-testid="integrate-crossing-commands">
        {p.packLedCommand}
      </pre>
      <p>
        <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank" data-testid="integrate-gh-deep-link">
          Crossing contract
        </a>
      </p>
      <p>This one command does three things:</p>
      <ul>
        <li>Reads your structured tool activity (NDJSON)</li>
        <li>
          Maps it against your stores using <code>tools.json</code>
        </li>
        <li>Runs read-only verification and returns a clear result</li>
      </ul>
      <p>
        Success = <code>exit 0</code> with <code>VERDICT: complete</code> and <code>trust: TRUSTED</code>.
      </p>
      <p className="muted">
        Failure surfaces explicit issues like <code>ROW_ABSENT</code> instead of letting silent gaps reach production.
      </p>

      <h2>Requirements</h2>
      <ul>
        {p.requirements.map((line) => (
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
          <Link href="/?demo=wf_missing#try-it">Try the interactive demo on the homepage</Link> (no account required)
        </li>
        <li>Run the command above on your own data</li>
        <li>
          <Link href="/guides">Follow the integration guides in Learn</Link> for deeper setup
        </li>
      </ol>

      <h2>Full documentation</h2>
      <p>
        <a href={p.githubDeepLink} rel="noopener noreferrer" target="_blank">
          Crossing contract
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
