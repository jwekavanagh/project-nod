type MailpitMessageSummary = { ID: string };

type MailpitMessagesResponse = {
  messages: MailpitMessageSummary[];
};

/**
 * Poll Mailpit for the latest magic-link URL sent to `toEmail` (commercial E2E harness).
 * Uses `GET http://127.0.0.1:8025/api/v1/messages` per docs/commercial.md.
 */
export async function pollLatestMagicLinkUrl(params: {
  toEmail: string;
  timeoutMs: number;
}): Promise<string> {
  const deadline = Date.now() + params.timeoutMs;
  const re = /https?:\/\/[^\s"'<>]+/i;
  while (Date.now() < deadline) {
    const listRes = await fetch("http://127.0.0.1:8025/api/v1/messages");
    if (!listRes.ok) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    const list = (await listRes.json()) as MailpitMessagesResponse;
    const ids = (list.messages ?? []).map((m) => m.ID).filter(Boolean);
    for (const id of ids) {
      const msgRes = await fetch(`http://127.0.0.1:8025/api/v1/message/${id}`);
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json()) as {
        To?: { Address?: string }[];
        HTML?: string;
        Text?: string;
      };
      const to = msg.To?.some((t) => t.Address?.toLowerCase() === params.toEmail.toLowerCase());
      if (!to) continue;
      const html = msg.HTML ?? "";
      const anchor = /<a[^>]+href=["']([^"']+)["'][^>]*>\s*Sign in\s*</i.exec(html);
      if (anchor?.[1]) return anchor[1];
      const blob = `${msg.Text ?? ""} ${html}`;
      const m = blob.match(re);
      if (m?.[0]) return m[0];
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`pollLatestMagicLinkUrl: timeout for ${params.toEmail}`);
}
