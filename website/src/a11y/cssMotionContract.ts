/**
 * Canonical reduced-motion rule. Must appear verbatim in `src/app/globals.css`
 * (see Vitest `reduced-motion-css-contract.test.ts`).
 */
export const REDUCED_MOTION_CSS_SNIPPET = `@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;
