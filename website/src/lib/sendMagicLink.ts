import nodemailer from "nodemailer";
import { Resend } from "resend";

const from = () => process.env.EMAIL_FROM ?? "Workflow Verifier <onboarding@example.com>";

export async function sendMagicLink(identifier: string, url: string): Promise<void> {
  if (process.env.E2E_COMMERCIAL_FUNNEL === "1") {
    const transport = nodemailer.createTransport({
      host: "127.0.0.1",
      port: 1025,
      secure: false,
    });
    await transport.sendMail({
      to: identifier,
      from: from(),
      subject: "Sign in to Workflow Verifier",
      text: `Sign in: ${url}`,
      html: `<p><a href="${url}">Sign in</a></p>`,
    });
    return;
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is required when E2E_COMMERCIAL_FUNNEL is not set");
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: from(),
    to: identifier,
    subject: "Sign in to Workflow Verifier",
    html: `<p><a href="${url}">Sign in</a></p>`,
  });
  if (error) {
    throw new Error(error.message);
  }
}
