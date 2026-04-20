import * as cheerio from "cheerio";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { integrateActivation } from "@/content/productCopy";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

const { integrateRequirements } = integrateActivation;

const buildIdPath = join(getRepoRoot(), "website", ".next", "BUILD_ID");
if (existsSync(buildIdPath)) {
  process.env.WEBSITE_TEST_REUSE_DIST = "1";
}

describe(
  "integrate page product prerequisites markup",
  { timeout: 600_000, hookTimeout: 600_000 },
  () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("main.integrate-main includes every integrateRequirements line from productCopy", async () => {
    const html = await getSiteHtml("/integrate");
    const $ = cheerio.load(html);
    const mainText = $("main.integrate-main").text();
    for (const line of integrateRequirements) {
      expect(mainText).toContain(line);
    }
  });
  },
);
