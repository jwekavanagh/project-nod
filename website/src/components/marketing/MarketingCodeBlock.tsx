import type { ComponentPropsWithoutRef } from "react";

export type MarketingCodeBlockProps = ComponentPropsWithoutRef<"pre"> & {
  /** Taller blocks with vertical scroll (long transcripts). */
  variant?: "default" | "scroll";
};

const variantClass: Record<NonNullable<MarketingCodeBlockProps["variant"]>, string> = {
  default: "marketing-code-block",
  scroll: "marketing-code-block marketing-code-block--scroll",
};

/**
 * Shared code / command block surface (matches integrate guide and acquisition terminal blocks).
 */
export function MarketingCodeBlock({ className, variant = "default", ...rest }: MarketingCodeBlockProps) {
  const merged = [variantClass[variant], className].filter(Boolean).join(" ");
  return <pre className={merged} {...rest} />;
}
