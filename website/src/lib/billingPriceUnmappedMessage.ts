/**
 * User-facing message for reserve deny `BILLING_PRICE_UNMAPPED` (deployment / operator remediation only).
 */
export function billingPriceUnmappedMessage(stripePriceId: string): string {
  const contact = process.env.CONTACT_SALES_EMAIL?.trim();
  const contactOk = contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  if (contactOk) {
    return `This deployment does not recognize Stripe price id ${stripePriceId}. Align STRIPE_PRICE_* environment variables with your Stripe prices, redeploy, or contact ${contact}.`;
  }
  return `This deployment does not recognize Stripe price id ${stripePriceId}. Align STRIPE_PRICE_* environment variables with your Stripe prices, redeploy, or contact the site operator.`;
}
