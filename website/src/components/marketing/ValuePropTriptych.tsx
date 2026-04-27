type ValuePropTriptychProps = {
  problem: string;
  solution: string;
  outcome: string;
};

export function ValuePropTriptych({ problem, solution, outcome }: ValuePropTriptychProps) {
  return (
    <section className="value-triptych" aria-label="Problem, solution, outcome">
      <article className="value-card">
        <p className="value-card-kicker">Problem</p>
        <p>{problem}</p>
      </article>
      <article className="value-card">
        <p className="value-card-kicker">Solution</p>
        <p>{solution}</p>
      </article>
      <article className="value-card">
        <p className="value-card-kicker">Outcome</p>
        <p>{outcome}</p>
      </article>
    </section>
  );
}
