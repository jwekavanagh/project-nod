import { DiscoverySurfacePage } from "@/components/discovery/DiscoverySurfacePage";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import { listSlugsForSegment, readSurfaceFile, type SurfaceSegment } from "@/lib/surfaceMarkdown";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const segment: SurfaceSegment = "compare";

export function generateStaticParams() {
  return listSlugsForSegment(segment).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const s = readSurfaceFile(segment, slug);
    return {
      title: s.title,
      description: s.description,
      robots: { index: true, follow: true },
      alternates: { canonical: indexableGuideCanonical(s.route) },
      ...marketingOpenGraphAndTwitter({ title: s.title, description: s.description }),
    };
  } catch {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
}

export default async function CompareSurfacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let surface;
  try {
    surface = readSurfaceFile(segment, slug);
  } catch {
    notFound();
  }
  return <DiscoverySurfacePage surface={surface} />;
}
