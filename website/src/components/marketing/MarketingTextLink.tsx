import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Common = {
  href: string;
  children: ReactNode;
  className?: string;
};

export type MarketingTextLinkProps =
  | (Common & { external?: false } & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">)
  | (Common & { external: true } & Omit<ComponentPropsWithoutRef<"a">, "href" | "className" | "children">);

/**
 * Prose-style text link for marketing pages: link token, underline, hover, and focus match the site contract.
 * Prefer this over ad hoc classes for non-CTA anchors inside document prose.
 */
export function MarketingTextLink(props: MarketingTextLinkProps) {
  const { href, children, className, external, ...rest } = props;
  const merged = ["marketing-text-link", className].filter(Boolean).join(" ");
  if (external) {
    return (
      <a href={href} className={merged} rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={merged} {...rest}>
      {children}
    </Link>
  );
}
