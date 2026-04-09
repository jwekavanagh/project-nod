import Link from "next/link";
import { loadCommercialPlans } from "@/lib/plans";

export default function HomePage() {
  const { plans } = loadCommercialPlans();
  return (
    <main>
      <h1>Workflow Verifier</h1>
      <p style={{ color: "var(--muted)", maxWidth: "36rem" }}>
        Read-only SQL checks that your database matches expectations from structured tool
        activity—at verification time, not just when a trace step succeeded.
      </p>
      <p>
        <Link href="/pricing">Pricing</Link>
        {" · "}
        <Link href="/auth/signin">Sign in</Link>
        {" · "}
        <Link href="/account">Account</Link>
      </p>
      <section className="pricing-grid" style={{ marginTop: "2rem" }}>
        {(Object.entries(plans) as [keyof typeof plans, (typeof plans)["starter"]][]).map(
          ([id, p]) => (
            <div key={id} className="card" data-plan={id}>
              <h2>{p.marketingHeadline}</h2>
              <p style={{ fontSize: "1.5rem", margin: "0.5rem 0" }}>{p.displayPrice}</p>
              <p style={{ color: "var(--muted)" }}>
                {p.includedMonthly === null
                  ? "Custom volume"
                  : `${p.includedMonthly.toLocaleString()} verifications / month`}
              </p>
            </div>
          ),
        )}
      </section>
    </main>
  );
}
