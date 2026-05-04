import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingLinkListProps = {
  children: ReactNode;
  className?: string;
  /** Use `<ol>` when numbered list semantics are required (most marketing lists use `unordered`). */
  variant?: "unordered" | "ordered";
};

/**
 * Vertical list shell for marketing content navigation rows — pairs with {@link MarketingLinkItem}
 * and {@link MarketingContentLink}.
 */
export function MarketingLinkList({ variant = "unordered", className, children }: MarketingLinkListProps) {
  const listClassName = ["mechanism-list", "marketing-link-list", className].filter(Boolean).join(" ");
  if (variant === "ordered") {
    return <ol className={listClassName}>{children}</ol>;
  }
  return <ul className={listClassName}>{children}</ul>;
}

export type MarketingLinkItemProps = {
  children: ReactNode;
} & ComponentPropsWithoutRef<"li">;

export function MarketingLinkItem({ className, children, ...rest }: MarketingLinkItemProps) {
  return (
    <li className={className} {...rest}>
      {children}
    </li>
  );
}

export type MarketingContentLinkProps = {
  href: string;
  title: ReactNode;
  /** Muted supporting lines (captions, symptoms, verification cues). */
  lines?: readonly ReactNode[];
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children" | "title">;

/**
 * Block link: bold title on the first line, optional muted lines underneath, aligned with list markers.
 */
export function MarketingContentLink({ href, title, lines, ...linkRest }: MarketingContentLinkProps) {
  return (
    <Link href={href} className="marketing-content-link" {...linkRest}>
      <span className="marketing-content-link__title">{title}</span>
      {lines
        ?.filter((line) => line != null && line !== "")
        .map((line, i) => (
          <span key={i} className="muted marketing-content-link__desc">
            {line}
          </span>
        ))}
    </Link>
  );
}
