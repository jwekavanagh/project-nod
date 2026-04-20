import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { pollLatestMagicLinkUrl } from "./helpers/mailpitMagicLink";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { version: string };

const runLayer = process.env.COMMERCIAL_OSS_EVAL_PLAYWRIGHT === "1";

test.describe("OSS eval-to-account (RR-E / RR-R6)", () => {
  test("full handoff → Mailpit sign-in → /claim (gated on COMMERCIAL_OSS_EVAL_PLAYWRIGHT)", async ({
    page,
    request,
  }) => {
    if (!runLayer) {
      test.skip();
    }
    const email = `oss-eval-${Date.now()}@mailpit.local`;
    const claimSecret = "a".repeat(64);
    const issuedAt = new Date().toISOString();
    const ticketRes = await request.post("/api/oss/claim-ticket", {
      headers: {
        "content-type": "application/json",
        "X-AgentSkeptic-Product": "cli",
        "X-AgentSkeptic-Cli-Version": rootPkg.version,
      },
      data: {
        schema_version: 2,
        telemetry_source: "unknown",
        interactive_human: false,
        claim_secret: claimSecret,
        run_id: `e2e:oss-eval-${Date.now()}`,
        issued_at: issuedAt,
        terminal_status: "complete",
        workload_class: "non_bundled",
        subcommand: "batch_verify",
        build_profile: "oss",
      },
    });
    expect(ticketRes.ok()).toBeTruthy();
    const ticket = (await ticketRes.json()) as { handoff_url?: string };
    expect(ticket.handoff_url).toContain("/verify/link?");

    const handoffRes = await request.get(ticket.handoff_url!, { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(handoffRes.status());

    await page.goto("/auth/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole("button", { name: /sign in|continue/i }).click();
    const url = await pollLatestMagicLinkUrl({ toEmail: email, timeoutMs: 60_000 });
    await page.goto(url);
    await expect(page).toHaveURL(/\/claim/);
    await expect(page.getByRole("heading", { name: /claim this run/i })).toBeVisible();
  });
});
