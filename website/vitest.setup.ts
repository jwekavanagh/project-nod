import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Block accidental outbound HTTP(S) to the committed public canonical host during Vitest.
 * `NEXT_PUBLIC_APP_URL` is often set to that origin for markup parity, but all page fetches
 * must go to the local `next start` harness (see `__tests__/helpers/siteTestServer.ts`), not the live site.
 * Set `AGENTSKEPTIC_ALLOW_PUBLIC_ORIGIN_FETCH=1` only if a test intentionally calls the public deployment.
 */
if (process.env.AGENTSKEPTIC_ALLOW_PUBLIC_ORIGIN_FETCH !== "1") {
  try {
    const anchorsPath = path.join(__dirname, "..", "config", "public-product-anchors.json");
    const { productionCanonicalOrigin } = JSON.parse(readFileSync(anchorsPath, "utf8")) as {
      productionCanonicalOrigin?: string;
    };
    const host = productionCanonicalOrigin ? new URL(productionCanonicalOrigin).hostname.toLowerCase() : "";
    if (host) {
      const orig = globalThis.fetch.bind(globalThis);
      globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        let urlStr: string;
        if (typeof input === "string") urlStr = input;
        else if (input instanceof URL) urlStr = input.href;
        else urlStr = input.url;
        let reqHost: string;
        try {
          reqHost = new URL(urlStr).hostname.toLowerCase();
        } catch {
          return orig(input, init);
        }
        if (reqHost === host) {
          throw new Error(
            `vitest: refused fetch to public canonical host "${host}" (${urlStr}). ` +
              `Website tests must hit 127.0.0.1 (local next start), not the live site. ` +
              `Override with AGENTSKEPTIC_ALLOW_PUBLIC_ORIGIN_FETCH=1 if deliberate.`,
          );
        }
        return orig(input, init);
      };
    }
  } catch {
    /* anchors missing in odd sandboxes; skip guard */
  }
}

/**
 * Defaults so `npx vitest run` works without a full .env when tests do not need real secrets.
 * Funnel persistence tests still require DATABASE_URL and throw in beforeAll if unset.
 */
if (!process.env.CONTACT_SALES_EMAIL?.trim()) {
  process.env.CONTACT_SALES_EMAIL = "sales-vitest@example.com";
}
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  process.env.AUTH_SECRET = "x".repeat(40);
}
