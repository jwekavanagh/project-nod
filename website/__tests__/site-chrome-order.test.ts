import * as cheerio from "cheerio";
import { describe, expect, beforeAll, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { buildSiteHeaderPrimaryLinks } from "@/lib/siteChrome";
import marketing from "@/lib/marketing";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

describe("site chrome header primary order (R1)", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("first-seen primary nav hrefs match buildSiteHeaderPrimaryLinks", async () => {
    const primary = buildSiteHeaderPrimaryLinks({
      anchors: {
        gitRepositoryUrl: publicProductAnchors.gitRepositoryUrl,
        npmPackageUrl: publicProductAnchors.npmPackageUrl,
        bugsUrl: publicProductAnchors.bugsUrl,
      },
      acquisitionHref: productCopy.homepageAcquisitionCta.href,
      acquisitionLabel: marketing.homepageAcquisitionCtaLabel,
    });
    const expected = [
      ...primary.slice(0, 2).map((l) => l.href),
      "/guides",
      "/problems",
      "/compare",
      ...primary.slice(2).map((l) => l.href),
    ];

    const html = await getSiteHtml("/");
    const $ = cheerio.load(html);
    const hrefs = $("nav[aria-label='Primary'] a")
      .map((_, el) => $(el).attr("href") ?? "")
      .get()
      .slice(0, expected.length);

    expect(hrefs).toEqual(expected);
  });
});
