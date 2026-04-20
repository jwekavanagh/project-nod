import { FunnelSurfaceBeacon } from "@/components/FunnelSurfaceBeacon";
import { IntegrateActivationBlock } from "@/components/IntegrateActivationBlock";
import { IntegrateCrossingCommands } from "@/components/IntegrateCrossingCommands";
import { integrateActivation } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: siteMetadata.integrate.title,
  description: siteMetadata.integrate.description,
};

export default function IntegratePage() {
  const a = integrateActivation;
  return (
    <main className="integrate-main integrate-prose">
      <FunnelSurfaceBeacon surface="integrate" />
      <h1>{siteMetadata.integrate.title}</h1>
      <p className="muted">{siteMetadata.integrate.description}</p>

      <h2>{a.crossingPrimaryHeading}</h2>
      <p className="muted">{a.crossingPrimaryLead}</p>
      <IntegrateCrossingCommands />

      <h2>{a.whyHeading}</h2>
      {a.whyParagraphs.map((p, i) => (
        <p key={i} className="muted">
          {p}
        </p>
      ))}

      <p className="muted">{a.icp}</p>

      <h2>{a.integrateRequirementsHeading}</h2>
      <ul className="muted">
        {a.integrateRequirements.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <details className="integrate-optional-spine">
        <summary>{a.optionalSpineSummary}</summary>
        <p className="muted">{a.optionalSpineLead}</p>
        <div data-testid="integrator-activation-commands">
          <IntegrateActivationBlock />
        </div>
        <h3>{a.spineCheckpointHeading}</h3>
        <p className="muted">{a.spineCheckpointIntro}</p>
        <ol className="muted">
          {a.spineCheckpointBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ol>
      </details>

      <h2>{a.productCompletionHeading}</h2>
      <p className="muted">{a.productCompletionIntro}</p>
      <ol className="muted">
        {a.productCompletionBullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ol>

      <h2>{a.provedHeading}</h2>
      <p className="muted">{a.proved}</p>

      <h2>{a.nextHeading}</h2>
      <p className="muted">{a.nextLead}</p>
      <ul className="integrate-next-steps">
        {a.nextSteps.map((step) => (
          <li key={step.title} className="integrate-next-step">
            <div className="integrate-next-step-title">{step.title}</div>
            {step.href.startsWith("http") ? (
              <a
                className="integrate-next-destination"
                href={step.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {step.linkLabel}
              </a>
            ) : (
              <Link className="integrate-next-destination" href={step.href}>
                {step.linkLabel}
              </Link>
            )}
            <p className="muted integrate-next-step-body">{step.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
