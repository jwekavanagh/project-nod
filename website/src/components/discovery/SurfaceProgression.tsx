import marketing from "@/lib/marketing";
import Link from "next/link";

export type SurfacePrimaryCta = "integrate" | "demo" | "pricing";

const primaryHref: Record<SurfacePrimaryCta, string> = {
  integrate: "/integrate",
  demo: "/?demo=wf_missing#try-it",
  pricing: "/pricing",
};

type Props = {
  primaryCta: SurfacePrimaryCta;
};

export function SurfaceProgression({ primaryCta }: Props) {
  const acquisitionPath = marketing.slug;
  const markedHref = primaryHref[primaryCta];
  const items: { href: string; label: string }[] = [
    { href: "/integrate", label: "Integrate" },
    { href: "/?demo=wf_missing#try-it", label: "Try demo" },
    { href: "/pricing", label: "Pricing" },
    { href: acquisitionPath, label: "How it works" },
    { href: "/security", label: "Security & Trust" },
  ];
  return (
    <nav aria-label="Next steps" data-surface-progression className="surface-progression home-cta-row">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-primary-cta={item.href === markedHref ? "true" : undefined}
          className={item.href === markedHref ? "btn" : "btn secondary"}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
