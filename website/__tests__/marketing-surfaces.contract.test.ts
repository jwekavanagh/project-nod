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

type M = {
  heroTitle: string;
  heroOutcome: string;
  heroMechanism: string;
  siteDefaultMetadata: { description: string };
  site: {
    integrate: { title: string; description: string };
    pricing: { heroTitle: string; heroSupporting: string; positioning: string };
  };
};

function loadMarketingConfig(): M {
  const root = getRepoRoot();
  return JSON.parse(readFileSync(join(root, "config", "marketing.json"), "utf8")) as M;
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

describe("marketing surface parity (HTML includes JSON needles)", { timeout: 300_000 }, () => {
  let m: M;

  beforeAll(async () => {
    m = loadMarketingConfig();
    await ensureMarketingSiteRunning();
  });

  it("home `/` includes hero title and homepage meta description (hero headline + outcome lines)", async () => {
    const html = await getSiteHtml("/");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(m.heroTitle));
    expect(flat).toContain(collapseWs(m.heroOutcome));
    expect(flat).toContain(collapseWs(m.heroMechanism));
  });

  it("`/integrate` includes integrate title and description from JSON", async () => {
    const html = await getSiteHtml("/integrate");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(m.site.integrate.title));
    expect(flat).toContain(collapseWs(m.site.integrate.description));
  });

  it("`/pricing` includes pricing hero copy from JSON", async () => {
    const html = await getSiteHtml("/pricing");
    const flat = collapseWs(html);
    expect(flat).toContain(collapseWs(m.site.pricing.heroTitle));
    expect(flat).toContain(collapseWs(m.site.pricing.heroSupporting));
    expect(flat).toContain(collapseWs(m.site.pricing.positioning));
  });

});
