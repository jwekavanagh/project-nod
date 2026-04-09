"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await signIn("email", { email, redirect: false });
    if (r?.error) {
      setMsg("Could not send sign-in email.");
    } else {
      setMsg("Check your email for the sign-in link.");
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <p style={{ color: "var(--muted)" }}>
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/pricing">Pricing</Link>
      </p>
      <form onSubmit={onSubmit} className="card" style={{ maxWidth: "24rem", marginTop: "1rem" }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: "0.35rem",
            padding: "0.5rem",
            borderRadius: 8,
            border: "1px solid #38444d",
            background: "#0f1419",
            color: "var(--fg)",
          }}
        />
        <button type="submit" style={{ marginTop: "1rem" }}>
          Send magic link
        </button>
      </form>
      {msg && <p style={{ marginTop: "1rem" }}>{msg}</p>}
    </main>
  );
}
