"use client";

import { useEffect, useRef } from "react";

export function FunnelSurfaceBeacon({
  surface,
}: {
  surface: "acquisition" | "integrate";
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void fetch("/api/funnel/surface-impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ surface }),
    });
  }, [surface]);

  return null;
}
