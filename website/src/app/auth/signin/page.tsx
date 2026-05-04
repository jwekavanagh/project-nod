import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInFormClient } from "./SignInFormClient";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your AgentSkeptic account for API keys, plan limits, and billing context.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <SignInFormClient />
      </Suspense>
    </main>
  );
}
