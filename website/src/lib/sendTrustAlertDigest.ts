import { Resend } from "resend";
import { resolvedMagicLinkFrom } from "./emailFrom";

export type SendTrustAlertDigestInput = {
  to: string;
  subject: string;
  textBody: string;
};

/**
 * Sends Operator trust digest via **Resend** (same transport family as magic-link).
 * Returns **`Resend` `data.id`** on success.
 */
export async function sendTrustAlertDigestEmail(input: SendTrustAlertDigestInput): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("TRUST_ALERT_MAIL_UNCONFIGURED");
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: resolvedMagicLinkFrom(),
    to: input.to,
    subject: input.subject,
    text: input.textBody,
    html: `<pre style="font-family: ui-monospace, monospace; white-space: pre-wrap">${escapeHtml(
      input.textBody,
    )}</pre>`,
  });
  if (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : JSON.stringify(error);
    throw new Error(message);
  }
  const id = data?.id;
  if (!id || typeof id !== "string") {
    throw new Error("Resend returned no email id");
  }
  return id;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
