/**
 * Resend rejects unverified `from` domains. `example.com` is never valid as a sender.
 * Use `onboarding@resend.dev` only until a domain is verified; production should set EMAIL_FROM.
 */
export const DEFAULT_MAGIC_LINK_FROM =
  "Workflow Verifier <onboarding@resend.dev>";

export function resolvedMagicLinkFrom(): string {
  const v = process.env.EMAIL_FROM?.trim();
  return v && v.length > 0 ? v : DEFAULT_MAGIC_LINK_FROM;
}
