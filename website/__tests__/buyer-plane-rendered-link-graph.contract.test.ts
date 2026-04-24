import { describe, expect, it, beforeAll } from "vitest";
import { JSDOM } from "jsdom";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

function internalPathHrefs(html: string): string[] {
  const { window } = new JSDOM(html);
  const out: string[] = [];
  for (const a of Array.from(window.document.querySelectorAll('a[href^="/"]'))) {
    const h = a.getAttribute("href");
    if (!h) continue;
    const path = h.split("#")[0]!.split("?")[0]!;
    if (path.startsWith("/")) out.push(path);
  }
  return out;
}

describe(
  "buyer plane rendered link graph",
  { timeout: 300_000 },
  () => {
    beforeAll(async () => {
      if (!process.env.DATABASE_URL?.trim()) {
        throw new Error("buyer-plane-rendered-link-graph: run via npm run validate-commercial from repo root");
      }
      process.env.VERCEL_ENV = "production";
      await ensureMarketingSiteRunning();
    });

    it("served HTML includes /compare on Req4 paths", async () => {
      for (const path of ["/", "/guides", "/problems", "/pricing", "/security"]) {
        const html = await getSiteHtml(path);
        expect(html).toContain('href="/compare"');
      }
    });

    it("BFS from entrypoints reaches proof-set routes within fetch budget", async () => {
      const seeds = ["/", "/problems", "/pricing", "/security"];
      const targets = new Set([
        "/examples/wf-complete",
        "/examples/wf-missing",
        "/database-truth-vs-traces",
        "/integrate",
        "/pricing",
      ]);
      const visited = new Set<string>();
      const queue: string[] = [...seeds];
      let fetches = 0;
      while (queue.length > 0 && fetches < 50) {
        const path = queue.shift()!;
        if (visited.has(path)) continue;
        visited.add(path);
        fetches++;
        const html = await getSiteHtml(path);
        for (const next of internalPathHrefs(html)) {
          if (!visited.has(next) && !queue.includes(next)) queue.push(next);
        }
      }
      for (const t of targets) {
        expect(visited.has(t), `expected to fetch ${t} within BFS budget; visited: ${[...visited].sort().join(", ")}`).toBe(
          true,
        );
      }
    });
  },
);
