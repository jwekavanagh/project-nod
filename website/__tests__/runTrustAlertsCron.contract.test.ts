import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const digestSend = vi.fn((_input: unknown) => Promise.resolve("email_resend_proof_id"));

vi.mock("@/lib/sendTrustAlertDigest", () => ({
  sendTrustAlertDigestEmail: (input: unknown) => digestSend(input),
}));

const state = vi.hoisted(() => ({
  selectIdx: 0,
}));

/** Must match **`TRUST_BLOCKED_ALERT_MIN_EVENTS`** (`@/lib/trustAlertConstants`) for threshold branch. */
const hoistedTrustMinEvents = vi.hoisted(() => ({ n: 3 as const }));

const inserts: Record<string, unknown>[] = [];

vi.mock("@/db/client", () => ({
  db: {
    select: () => {
      state.selectIdx += 1;
      const i = state.selectIdx;

      /** ① Grouped **`trust_decision_blocked`** counts. */
      if (i === 1) {
        return {
          from: () => ({
            where: () => ({
              groupBy: () =>
                Promise.resolve([{ userId: "usr_trust_cron_proof", n: BigInt(hoistedTrustMinEvents.n) }]),
            }),
          }),
        };
      }
      /** ② Checkpoint rows for candidate users. */
      if (i === 2) {
        return {
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        };
      }
      /** ③ User email lookup. */
      if (i === 3) {
        return {
          from: () => ({
            where: () =>
              Promise.resolve([{ id: "usr_trust_cron_proof", email: "trust-cron@example.com" }]),
          }),
        };
      }
      /** ④ Recent **`funnel_event`** samples for digest body. */
      if (i === 4) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      metadata: { fixture: true },
                      createdAt: new Date("2026-04-01T12:00:00.000Z"),
                    },
                  ]),
              }),
            }),
          }),
        };
      }

      throw new Error(`unexpected select() seq ${i} in trust alerts cron mock`);
    },

    transaction: (fn: (tx: DrizzleTxStub) => Promise<void>) =>
      Promise.resolve(fn(buildTx(inserts))),
  },
}));

import { TRUST_BLOCKED_ALERT_MIN_EVENTS } from "@/lib/trustAlertConstants";

function buildTx(buf: Record<string, unknown>[]): DrizzleTxStub {
  return {
    insert: () => ({
      values: (payload: Record<string, unknown>) => {
        buf.push(payload);
        if ("resendEmailId" in payload && typeof (payload as { resendEmailId?: unknown }).resendEmailId === "string") {
          return Promise.resolve(undefined);
        }
        return {
          onConflictDoUpdate: () => Promise.resolve(undefined),
        };
      },
    }),
  };
}

type DrizzleTxStub = {
  insert: () => {
    values: (payload: Record<string, unknown>) =>
      | Promise<void>
      | { onConflictDoUpdate: () => Promise<void> };
  };
};

describe("runTrustAlertsCron", () => {
  beforeEach(() => {
    expect(TRUST_BLOCKED_ALERT_MIN_EVENTS).toBe(hoistedTrustMinEvents.n);
    state.selectIdx = 0;
    inserts.length = 0;
    digestSend.mockClear();
    vi.stubEnv("RESEND_API_KEY", "re_test_key_for_trust_digest");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mocks digest email and persists delivery + checkpoint inserts in the cron transaction", async () => {
    const { runTrustAlertsCron } = await import("@/lib/runTrustAlertsCron");
    const result = await runTrustAlertsCron();

    expect(result.status).toBe(200);
    expect(result.kind).toBe("delivered");
    if (result.kind === "delivered") {
      expect(result.body.sent[0]?.resend_email_id).toBe("email_resend_proof_id");
    }
    expect(digestSend).toHaveBeenCalledTimes(1);
    expect(inserts.some((row) => typeof row.resendEmailId === "string" && row.resendEmailId.length > 0)).toBe(
      true,
    );
    /** Second insert upserts checkpoint (**`last_digest_sent_at`**). */
    expect(inserts.some((row) => row.lastDigestSentAt instanceof Date)).toBe(true);
  });

  it("returns TRUST_ALERT_MAIL_UNCONFIGURED when RESEND_API_KEY is absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { runTrustAlertsCron } = await import("@/lib/runTrustAlertsCron");
    const result = await runTrustAlertsCron();
    expect(result).toEqual({
      kind: "mail_unconfigured",
      status: 500,
      body: { code: "TRUST_ALERT_MAIL_UNCONFIGURED" },
    });
    expect(digestSend).not.toHaveBeenCalled();
    expect(inserts.length).toBe(0);
  });
});
