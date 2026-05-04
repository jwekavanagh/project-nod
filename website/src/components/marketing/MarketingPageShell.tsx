import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingPageShellVariant = "home" | "document" | "documentProse" | "pricing";

const variantClasses: Record<MarketingPageShellVariant, string> = {
  home: "marketing-shell marketing-shell--home",
  document: "marketing-shell integrate-main marketing-shell--document",
  documentProse: "marketing-shell integrate-main integrate-prose marketing-shell--document",
  pricing: "marketing-shell integrate-main pricing-page marketing-shell--document",
};

export type MarketingPageShellProps = {
  variant: MarketingPageShellVariant;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"main">, "className" | "children">;

/**
 * Shared outer `<main>` for marketing surfaces. Keeps `integrate-main` where DOM/tests expect it.
 */
export function MarketingPageShell({ variant, className, children, ...rest }: MarketingPageShellProps) {
  const merged = [variantClasses[variant], className].filter(Boolean).join(" ");
  return (
    <main className={merged} {...rest}>
      {children}
    </main>
  );
}
