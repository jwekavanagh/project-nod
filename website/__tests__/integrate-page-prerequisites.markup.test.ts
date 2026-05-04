import * as cheerio from "cheerio";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

const REQUIREMENT_LINES = [
  "Node.js 22 or newer",
  "read-only access to the database or snapshot you want to verify",
  "structured tool activity exported as NDJSON",
];

const buildIdPath = join(getRepoRoot(), "website", ".next", "BUILD_ID");
if (existsSync(buildIdPath)) {
  process.env.WEBSITE_TEST_REUSE_DIST = "1";
}

describe("integrate page product prerequisites markup", { timeout: 600_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("main.integrate-main includes simplified requirements lines", async () => {
    const html = await getSiteHtml("/integrate");
    const $ = cheerio.load(html);
    const mainText = $("main.integrate-main").text();
    for (const line of REQUIREMENT_LINES) {
      expect(mainText).toContain(line);
    }
  });
});
