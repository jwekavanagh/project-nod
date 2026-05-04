import type { HTMLAttributes, ReactNode } from "react";

export type MarketingPageHeaderProps = {
  title: ReactNode;
  /** Short emphasis line under the title (often wrapped in `<strong>`). */
  kicker?: ReactNode;
  /** Supporting body under the kicker (paragraphs, muted text, etc.). */
  description?: ReactNode;
  className?: string;
  headingTestId?: string;
  headingProps?: HTMLAttributes<HTMLHeadingElement>;
};

/**
 * One page title pattern: H1 + optional kicker + optional description block.
 */
export function MarketingPageHeader({
  title,
  kicker,
  description,
  className,
  headingTestId,
  headingProps,
}: MarketingPageHeaderProps) {
  return (
    <header className={["marketing-page-header", className].filter(Boolean).join(" ")}>
      <h1 className="marketing-page-title" data-testid={headingTestId} {...headingProps}>
        {title}
      </h1>
      {kicker ? <div className="marketing-page-kicker">{kicker}</div> : null}
      {description ? <div className="marketing-page-description">{description}</div> : null}
    </header>
  );
}
