type WhenToUseDecisionBoxProps = {
  id?: string;
  title: string;
  strongFitHeading: string;
  notDesignedHeading: string;
  strongFitBullets: readonly string[];
  notDesignedBullets: readonly string[];
};

export function WhenToUseDecisionBox({
  id = "when-to-use-heading",
  title,
  strongFitHeading,
  notDesignedHeading,
  strongFitBullets,
  notDesignedBullets,
}: WhenToUseDecisionBoxProps) {
  return (
    <section className="decision-box" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="decision-box-grid">
        <article>
          <h3>{strongFitHeading}</h3>
          <ul>
            {strongFitBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>{notDesignedHeading}</h3>
          <ul>
            {notDesignedBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
