import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Email from "next-auth/providers/email";
import { db } from "./db/client";
import { resolvedMagicLinkFrom } from "./lib/emailFrom";
import { recordSignInFunnel } from "./lib/recordSignInFunnel";
import { runMagicLinkVerificationRequest } from "./lib/runMagicLinkVerificationRequest";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "./db/schema";

export const authConfig = {
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  events: {
    async signIn({ user }) {
      if (user.id) await recordSignInFunnel(user.id);
    },
  },
  providers: [
    Email({
      // Auth.js validates a Nodemailer `server` even when `sendVerificationRequest` sends via Resend/Mailpit.
      server: process.env.EMAIL_SERVER ?? {
        host: "127.0.0.1",
        port: 1025,
        secure: false,
        auth: { user: "", pass: "" },
      },
      from: resolvedMagicLinkFrom(),
      sendVerificationRequest: async (params) => {
        await runMagicLinkVerificationRequest(params);
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        try {
          const row = await db
            .select({ plan: users.plan, subscriptionStatus: users.subscriptionStatus })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);
          const su = session.user as {
            plan?: string;
            subscriptionStatus?: "none" | "active" | "inactive";
          };
          su.plan = row[0]?.plan ?? "starter";
          const ss = row[0]?.subscriptionStatus;
          su.subscriptionStatus =
            ss === "none" || ss === "active" || ss === "inactive" ? ss : "none";
        } catch (e) {
          if (process.env.NODE_ENV !== "development") {
            throw e;
          }
          console.warn(
            "[auth] session plan lookup skipped (database unreachable?)",
            e,
          );
          const su = session.user as {
            plan?: string;
            subscriptionStatus?: "none" | "active" | "inactive";
          };
          su.plan = "starter";
          su.subscriptionStatus = "none";
        }
      }
      return session;
    },
  },
  session: { strategy: "database" },
} satisfies NextAuthConfig;
