import * as cheerio from "cheerio";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBuyerTruth } from "@/lib/buyerTruth";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

const requirements = [...loadBuyerTruth().integrateRequirements];

const buildIdPath = join(getRepoRoot(), "website", ".next", "BUILD_ID");
if (existsSync(buildIdPath)) {
  process.env.WEBSITE_TEST_REUSE_DIST = "1";
}

describe("integrate page product prerequisites markup", { timeout: 600_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("main.integrate-main includes every requirements line from config/buyer-truth.v1.json", async () => {
    const html = await getSiteHtml("/integrate");
    const $ = cheerio.load(html);
    const mainText = $("main.integrate-main").text();
    for (const line of requirements) {
      expect(mainText).toContain(line);
    }
  });
});
