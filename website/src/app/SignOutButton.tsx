"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ variant }: { variant: "nav" | "account" }) {
  return (
    <button
      type="button"
      className={variant === "nav" ? "site-nav-signout" : "secondary"}
      data-testid="sign-out-button"
      onClick={() => void signOut({ callbackUrl: "/" })}
    >
      Sign out
    </button>
  );
}
