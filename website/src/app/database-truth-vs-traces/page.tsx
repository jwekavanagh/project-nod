import discoveryAcquisition from "@/lib/discoveryAcquisition";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: discoveryAcquisition.pageMetadata.title,
  description: discoveryAcquisition.pageMetadata.description,
};

export default function DatabaseTruthVsTracesPage() {
  return (
    <main className="integrate-main">
      <h1 data-testid="acquisition-hero-title">{discoveryAcquisition.heroTitle}</h1>
      <p className="lede">{discoveryAcquisition.heroSubtitle}</p>
      <p className="lede" data-testid="visitor-problem-answer">
        {discoveryAcquisition.visitorProblemAnswer}
      </p>
      {discoveryAcquisition.sections.map((section) => (
        <section key={section.heading} className="home-section">
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 64)}>{paragraph}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
