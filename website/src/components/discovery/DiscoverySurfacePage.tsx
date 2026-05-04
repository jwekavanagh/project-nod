import { ExampleVerificationEmbed } from "@/components/examples/ExampleVerificationEmbed";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { IndexedGuideShell } from "@/components/guides/IndexedGuideShell";
import type { ParsedSurfaceFile } from "@/lib/surfaceMarkdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DiscoveryArticleJsonLd } from "./DiscoveryArticleJsonLd";
import { SurfaceProgression } from "./SurfaceProgression";

type Props = {
  surface: ParsedSurfaceFile;
};

function breadcrumbMiddleForSurface(surface: ParsedSurfaceFile): { name: string; path: string } | undefined {
  if (surface.segment === "guides") return { name: "Learn", path: "/guides" };
  if (surface.segment === "compare") return { name: "Compare", path: "/compare" };
  return { name: "Learn", path: "/guides" };
}

export function DiscoverySurfacePage({ surface }: Props) {
  const jsonLd = (
    <DiscoveryArticleJsonLd
      headline={surface.title}
      description={surface.description}
      path={surface.route}
      breadcrumbMiddle={breadcrumbMiddleForSurface(surface)}
    />
  );
  const progression = <SurfaceProgression primaryCta="integrate" />;
  const article = (
    <article className="integrate-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{surface.body}</ReactMarkdown>
    </article>
  );
  if (surface.surfaceKind === "comparison") {
    return (
      <>
        {jsonLd}
        <MarketingPageShell variant="document">
          {article}
          {progression}
        </MarketingPageShell>
      </>
    );
  }
  if (surface.surfaceKind === "example") {
    return (
      <>
        {jsonLd}
        <MarketingPageShell variant="document">
          {article}
          <ExampleVerificationEmbed variant={surface.embedKey!} />
          {progression}
        </MarketingPageShell>
      </>
    );
  }
  return (
    <>
      {jsonLd}
      <IndexedGuideShell progressionStrip={progression}>{article}</IndexedGuideShell>
    </>
  );
}
