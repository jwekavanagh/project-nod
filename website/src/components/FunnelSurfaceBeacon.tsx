"use client";

import {
  ATTRIBUTION_PATH_MAX_CODEPOINTS,
  ATTRIBUTION_UTM_MAX_CODEPOINTS,
  countUnicodeCodePoints,
} from "@/lib/funnelAttribution";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "agentskeptic_funnel_anon_id";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function buildAttributionFromWindow(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  const attr: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const k of UTM_KEYS) {
    const v = params.get(k)?.trim();
    if (v && countUnicodeCodePoints(v) <= ATTRIBUTION_UTM_MAX_CODEPOINTS) {
      attr[k] = v;
    }
  }
  const landing = window.location.pathname + window.location.search;
  if (countUnicodeCodePoints(landing) > ATTRIBUTION_PATH_MAX_CODEPOINTS) {
    return null;
  }
  attr.landing_path = landing;
  try {
    const ref = document.referrer?.trim();
    if (ref) {
      const u = new URL(ref);
      if (u.origin === window.location.origin) {
        const rp = u.pathname + u.search;
        if (countUnicodeCodePoints(rp) <= ATTRIBUTION_PATH_MAX_CODEPOINTS) {
          attr.referrer_path = rp;
        }
      }
    }
  } catch {
    /* ignore bad referrer */
  }
  return attr;
}

export function FunnelSurfaceBeacon({
  surface,
}: {
  surface: "acquisition" | "integrate";
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (typeof window === "undefined") return;
    const origin = window.location?.origin;
    if (!origin || origin === "null") return;
    fired.current = true;
    const url = new URL("/api/funnel/surface-impression", origin).href;

    const stored = window.localStorage?.getItem(STORAGE_KEY)?.trim();
    const attribution = buildAttributionFromWindow();
    const body: Record<string, unknown> = { surface };
    if (stored) {
      body.funnel_anon_id = stored;
    }
    if (attribution && Object.keys(attribution).length > 0) {
      body.attribution = attribution;
    }

    const useKeepalive = Boolean(stored);

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: useKeepalive,
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const j = (await res.json()) as { funnel_anon_id?: string };
        if (typeof j.funnel_anon_id === "string" && j.funnel_anon_id.length > 0) {
          try {
            window.localStorage?.setItem(STORAGE_KEY, j.funnel_anon_id);
          } catch {
            /* ignore quota */
          }
        }
      })
      .catch(() => {});
  }, [surface]);

  return null;
}
