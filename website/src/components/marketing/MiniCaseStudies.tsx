type MiniCaseStudy = {
  title: string;
  before: string;
  after: string;
  outcome: string;
  architecture: string;
};

export function MiniCaseStudies({ studies }: { studies: readonly MiniCaseStudy[] }) {
  return (
    <section className="mini-case-studies" aria-labelledby="mini-case-studies-heading">
      <h2 id="mini-case-studies-heading">Case studies</h2>
      <div className="mini-case-grid">
        {studies.map((study) => (
          <article key={study.title} className="mini-case-card">
            <h3>{study.title}</h3>
            <p>
              <strong>Before:</strong> {study.before}
            </p>
            <p>
              <strong>After:</strong> {study.after}
            </p>
            <p>
              <strong>Outcome:</strong> {study.outcome}
            </p>
            <p className="muted">
              <strong>Architecture:</strong> {study.architecture}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
