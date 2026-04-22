import { VerificationReportView } from "@/components/VerificationReportView";
import { getExampleEmbed } from "@/lib/exampleEmbeds";
import { derivedFieldsFromEnvelope } from "@/lib/publicVerificationReportService";

type Variant = "wf_complete" | "wf_missing" | "langgraph_checkpoint_trust";

const titles: Record<Variant, string> = {
  wf_complete: "Bundled demo: wf_complete (verified)",
  wf_missing: "Bundled demo: wf_missing (ROW_ABSENT)",
  langgraph_checkpoint_trust: "LangGraph checkpoint trust: verified (B-row certificate)",
};

const blurbs: Record<Variant, string> = {
  wf_complete:
    "The block below uses the committed public-report envelope for wf_complete so this page stays aligned with the engine.",
  wf_missing:
    "The block below reuses the same bundled wf_missing envelope used on indexable guides so ROW_ABSENT stays consistent.",
  langgraph_checkpoint_trust:
    "The block below is a captured Outcome Certificate v1 from `contract_sql_langgraph_checkpoint_trust` verify (partner quickstart contract) so you can see checkpoint verdicts without running the CLI.",
};

type Props = {
  variant: Variant;
};

export function ExampleVerificationEmbed({ variant }: Props) {
  const embed = getExampleEmbed(variant);
  const { humanText } = derivedFieldsFromEnvelope(embed);
  return (
    <section className="home-section" aria-labelledby={`example-embed-${variant}`}>
      <h2 id={`example-embed-${variant}`}>{titles[variant]}</h2>
      <p className="muted">{blurbs[variant]}</p>
      <VerificationReportView humanText={humanText} payload={embed} variant="embed" />
    </section>
  );
}
