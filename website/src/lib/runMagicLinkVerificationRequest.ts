import { sendMagicLink } from "./sendMagicLink";
import { reserveMagicLinkSendSlot } from "./magicLinkSendGate";

export type MagicLinkVerificationParams = {
  identifier: string;
  url: string;
  request?: Request;
};

/**
 * Auth.js `sendVerificationRequest` entry: preconditions (plain `Error`), rate reservation, then email send.
 */
export async function runMagicLinkVerificationRequest(params: MagicLinkVerificationParams): Promise<void> {
  if (typeof params.identifier !== "string") {
    throw new Error("Magic link verification: identifier must be a string");
  }
  if (typeof params.url !== "string") {
    throw new Error("Magic link verification: url must be a string");
  }
  if (params.identifier.trim() === "") {
    throw new Error("Magic link verification: identifier is empty");
  }

  const req =
    params.request instanceof Request
      ? params.request
      : new Request("https://internal.invalid");

  const emailForSend = params.identifier.trim().toLowerCase();
  await reserveMagicLinkSendSlot(req, emailForSend);
  await sendMagicLink(emailForSend, params.url);
}
