import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { metadata as compareHubMetadata } from "@/app/compare/page";
import { metadata as contactMetadata } from "@/app/contact/page";
import { metadata as guidesHubMetadata } from "@/app/guides/page";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as pricingMetadata } from "@/app/pricing/page";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { metadata as problemsMetadata } from "@/app/problems/page";
import { metadata as securityMetadata } from "@/app/security/page";
import { metadata as supportMetadata } from "@/app/support/page";
import { metadata as termsMetadata } from "@/app/terms/page";
import { metadata as notFoundMetadata } from "@/app/not-found";

const TEMPLATE_SUFFIX = / — AgentSkeptic$/;

function segmentTitle(m: Metadata): string {
  const t = m.title;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && t !== null && "absolute" in t) {
    const a = (t as { absolute?: string }).absolute;
    if (typeof a === "string") return a;
  }
  return "";
}

/**
 * Child routes under `app/layout.tsx` use `title.template: "%s — AgentSkeptic"`.
 * `metadata.title` must be the segment only so the resolved &lt;title&gt; is not doubled.
 */
describe("metadata.title segment (no pre-branded template suffix)", () => {
  it("marketing hubs and static pages export short titles", () => {
    for (const [label, m] of [
      ["guides", guidesHubMetadata],
      ["compare", compareHubMetadata],
      ["contact", contactMetadata],
      ["privacy", privacyMetadata],
      ["terms", termsMetadata],
      ["security", securityMetadata],
      ["support", supportMetadata],
      ["problems", problemsMetadata],
    ] as const) {
      const s = segmentTitle(m);
      expect(s, label).toBeTruthy();
      expect(s, label).not.toMatch(TEMPLATE_SUFFIX);
    }
  });

  it("pricing uses generateMetadata-equivalent segment (import static const from module)", async () => {
    const { generateMetadata } = await import("@/app/pricing/page");
    const m = await generateMetadata();
    expect(typeof m.title).toBe("string");
    expect(String(m.title)).toBe("Pricing");
    expect(String(m.openGraph?.title)).toMatch(TEMPLATE_SUFFIX);
  });

  it("openGraph titles stay full public strings with one brand suffix", () => {
    expect(String(guidesHubMetadata.openGraph?.title)).toBe("Learn — AgentSkeptic");
    expect(String(compareHubMetadata.openGraph?.title)).toBe("Compare approaches — AgentSkeptic");
    expect(String(contactMetadata.openGraph?.title)).toBe("Contact — AgentSkeptic");
  });
});

describe("exceptions (root home, not-found)", () => {
  it("home exports a full marketing title (root route resolution; unchanged)", () => {
    const t = homeMetadata.title;
    expect(typeof t).toBe("string");
    expect(String(t)).toMatch(TEMPLATE_SUFFIX);
  });

  it("not-found uses title.absolute and includes the brand once", () => {
    const t = notFoundMetadata.title;
    expect(t && typeof t === "object" && "absolute" in t).toBe(true);
    expect(String(segmentTitle(notFoundMetadata))).toBe("Not found — AgentSkeptic");
  });
});
