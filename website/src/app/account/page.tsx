import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

import { AccountClient } from "./AccountClient";
import { db } from "@/db/client";
import { apiKeys } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const keys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)));

  const masked = keys[0] ? `wf_sk_live_****… (created)` : null;

  return (
    <main>
      <h1>Account</h1>
      <p style={{ color: "var(--muted)" }}>
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/pricing">Pricing</Link>
      </p>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p>
          Signed in as <strong>{session.user.email}</strong>
        </p>
        <p>
          Plan: <strong>{(session.user as { plan?: string }).plan ?? "starter"}</strong>
        </p>
        {masked && <p>API key: {masked}</p>}
      </div>
      <AccountClient hasKey={keys.length > 0} />
    </main>
  );
}
