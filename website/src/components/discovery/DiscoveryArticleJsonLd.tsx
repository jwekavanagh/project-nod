import { discoveryArticleJsonLdGraph } from "@/lib/discoveryArticleJsonLd";

type Props = {
  headline: string;
  description: string;
  path: string;
  breadcrumbMiddle?: { name: string; path: string };
};

export function DiscoveryArticleJsonLd({ headline, description, path, breadcrumbMiddle }: Props) {
  const graph = discoveryArticleJsonLdGraph({ headline, description, path, breadcrumbMiddle });
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
