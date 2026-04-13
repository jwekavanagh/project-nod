import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { embeddedPartnerQuickstartCommandsMd } from "@/generated/integratorDocsEmbedded";

/**
 * Renders generated docs/partner-quickstart-commands.md from build-embedded SSOT (no runtime repo fs).
 */
export function FirstRunActivationGuide() {
  const md = embeddedPartnerQuickstartCommandsMd;
  return (
    <section className="integrate-guide" aria-labelledby="integrate-guide-heading">
      <h2 id="integrate-guide-heading">First run (commands)</h2>
      <p className="muted">
        Same content as <code>docs/partner-quickstart-commands.md</code> — sole SSOT for copy-paste shell
        commands (embedded at build time). Narrative and guarantees follow below.
      </p>
      <article className="integrate-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>
    </section>
  );
}
