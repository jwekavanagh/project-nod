import { productCopy } from "@/content/productCopy";

export type ActivationUi = "idle" | "pending" | "ready" | "timeout";

/** Single assertive live-region text for AccountClient (priority: portal → key error → activation timeout). */
export function accountAssertiveMessage(
  portalErr: string | null,
  err: string | null,
  activationUi: ActivationUi,
): string | null {
  return (
    portalErr ??
    err ??
    (activationUi === "timeout" ? productCopy.account.checkoutActivationTimeout : null)
  );
}
