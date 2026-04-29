import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import { VerifyPageClient } from "./VerifyPageClient";

export const metadata: Metadata = {
  title: "Paste verification — AgentSkeptic",
  description:
    "Paste NDJSON events and verify whether stored state matches the claim, with no setup required.",
  alternates: { canonical: indexableGuideCanonical("/verify") },
};

export default function VerifyPage() {
  return (
    <main>
      <VerifyPageClient />
    </main>
  );
}
