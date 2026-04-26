type ProofStackProps = {
  logosTitle: string;
  logos: readonly string[];
  testimonials: readonly string[];
  metrics: readonly string[];
};

export function ProofStack({ logosTitle, logos, testimonials, metrics }: ProofStackProps) {
  return (
    <section className="proof-stack" aria-label="Customer proof">
      <p className="muted proof-stack-title">{logosTitle}</p>
      <ul className="proof-stack-logos" aria-label="Customer logos">
        {logos.map((logo) => (
          <li key={logo}>{logo}</li>
        ))}
      </ul>
      <ul className="proof-stack-testimonials">
        {testimonials.map((quote) => (
          <li key={quote}>{quote}</li>
        ))}
      </ul>
      <ul className="proof-stack-metrics">
        {metrics.map((metric) => (
          <li key={metric}>{metric}</li>
        ))}
      </ul>
    </section>
  );
}
