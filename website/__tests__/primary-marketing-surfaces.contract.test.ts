import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

type Pm = {
  heroTitle: string;
  pageMetadata: { description: string };
  site: {
    integrate: { title: string; description: string };
    pricing: { heroTitle: string; positioning: string };
  };
  r2: { frameworkMaturity: string };
};

function loadPrimaryMarketing(): Pm {
  const root = getRepoRoot();
  return JSON.parse(readFileSync(join(root, "config", "primary-marketing.json"), "utf8")) as Pm;
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

describe("primary marketing surface parity (HTML includes JSON needles)", { timeout: 180_000 }, () => {
  let pm: Pm;

  beforeAll(async () => {
    pm = loadPrimaryMarketing();
    await ensureMarketingSiteRunning();
  });

  it("home `/` includes hero and default page description from primary-marketing.json", async () => {
    const html = await getSiteHtml("/");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(pm.heroTitle));
    expect(flat).toContain(collapseWs(pm.pageMetadata.description));
  });

  it("`/integrate` includes integrate title and description from JSON", async () => {
    const html = await getSiteHtml("/integrate");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(pm.site.integrate.title));
    expect(flat).toContain(collapseWs(pm.site.integrate.description));
  });

  it("`/pricing` includes pricing hero copy from JSON", async () => {
    const html = await getSiteHtml("/pricing");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(pm.site.pricing.heroTitle));
    expect(flat).toContain(collapseWs(pm.site.pricing.positioning));
  });

  it("home includes r2 framework maturity (buyer line)", async () => {
    const html = await getSiteHtml("/");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(pm.r2.frameworkMaturity));
  });
});
