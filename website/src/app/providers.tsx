"use client";

import { SiteFunnelAttribution } from "@/components/SiteFunnelAttribution";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SiteFunnelAttribution />
      {children}
    </SessionProvider>
  );
}
