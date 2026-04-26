import { INTEGRATE_ACTIVATION_SHELL_BODY } from "@/generated/integrateActivationShellStatic";
import marketing from "@/lib/marketing";
import { conversionSpine } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: siteMetadata.integrate.title,
  description: siteMetadata.integrate.description,
  alternates: { canonical: indexableGuideCanonical("/integrate") },
  robots: { index: true, follow: true },
};

export default function IntegratePage() {
  const p = marketing.integratePage;
  return (
    <main className="integrate-main integrate-prose" data-testid="integrate-page">
      <h1>{siteMetadata.integrate.title}</h1>
      <p className="lede integrate-benefit-lede">
        <strong>{siteMetadata.integrate.description}</strong>
      </p>
      <p className="lede">
        Run a single verification that compares what your agents and tools claimed against your actual stored state.
      </p>
      <p className="lede">Get a clear, binary verdict before you ship, bill, or hand off to customers.</p>
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

      <h2>Cross the boundary (canonical path)</h2>
      <p>
        <code>agentskeptic crossing</code> is the one-shot pack-led entry: NDJSON tool lines, a registry, and
        read-only state in one pass. Normative behavior is documented in the crossing contract below.
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

      <h2>Product completion: Step 4 on your emitters</h2>
      <p>
        Wire your tool and workflow code so it emits the NDJSON and registry this command consumes. The mechanical
        spine (clone, build, first-run) is an optional on-ramp in the section below—product completion is your
        emitters and stores matching the expected shape.
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
        className="integrate-optional-spine"
        aria-label="Mechanical spine (optional, for full end-to-end validation)"
      >
        <p className="integrate-optional-spine-label muted">
          Mechanical spine (optional, for full end-to-end validation)
        </p>
        <h3>Mechanical spine checkpoint (not product completion)</h3>
        <p>
          Long-form bash template for local machines and CI. This is not a substitute for wiring your own emitters—the
          crossing command above is the product-shaped gate.
        </p>
        <pre className="integrate-activation-commands" data-testid="integrator-activation-commands">
          {INTEGRATE_ACTIVATION_SHELL_BODY}
        </pre>
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
