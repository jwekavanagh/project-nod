import Link from "next/link";

const funnels = [
  {
    title: "New visitor",
    path: "Home -> How it works -> Demo",
    href: "/database-truth-vs-traces",
    ctaLabel: "See a failed vs passed run",
  },
  {
    title: "Technical evaluator",
    path: "Home -> Get started -> CLI docs",
    href: "/integrate",
    ctaLabel: "Run first verification",
  },
  {
    title: "Buyer",
    path: "Home -> Compare -> Pricing -> Contact",
    href: "/compare",
    ctaLabel: "View buyer path",
  },
] as const;

export function FunnelRouteCards() {
  return (
    <section className="funnel-route-cards" aria-labelledby="funnel-routes-heading">
      <h2 id="funnel-routes-heading">Choose your path</h2>
      <div className="funnel-route-grid">
        {funnels.map((funnel) => (
          <article className="funnel-route-card" key={funnel.title}>
            <h3>{funnel.title}</h3>
            <p className="muted">{funnel.path}</p>
            <Link href={funnel.href} className="link-secondary">
              {funnel.ctaLabel}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
