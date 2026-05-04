import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingSectionProps = {
  children: ReactNode;
} & ComponentPropsWithoutRef<"section">;

/**
 * Section rhythm shared with the homepage (`home-section`).
 */
export function MarketingSection({ className, children, ...rest }: MarketingSectionProps) {
  return (
    <section className={["home-section", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </section>
  );
}
