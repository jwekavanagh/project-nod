import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACT_SNIPPETS = [
  "Per normalized email address, the product allows at most 5 successful reservations per UTC calendar hour.",
  "Per derived client IP, the product allows at most 30 successful reservations per UTC calendar hour.",
  "A rate-limited deny rolls back the transaction so stored counters on both scope rows are unchanged from their pre-attempt values.",
  "After a reservation commits, if downstream email delivery fails, counters are not rolled back.",
  'When no client IP can be derived, requests use the scope_key "unknown" for the ip scope.',
  "The client-visible code for rate limit denial is magic_link_rate_limited.",
  "Deny logs must be a single console.warn string matching this regular expression: ^\\[magic_link_rate_limit\\] deny scope=(email|ip) window=\\d{4}-\\d{2}-\\d{2}T\\d{2}:00:00\\.000Z key_fp=[0-9a-f]{64}$",
  "Reservations run in SERIALIZABLE transactions with at most five retries on serialization_failure using backoff starting at 5 ms and capped at 80 ms total sleep before surfacing magic_link_rate_limited.",
  "Before reserveMagicLinkSendSlot, the runner validates only typeof checks and non-empty trimmed identifier using plain Error throws; CredentialsSignin with magic_link_rate_limited is reserved for rate-limit denials from reserveMagicLinkSendSlot.",
] as const;

describe("magic-link-rate-limit doc contract", () => {
  it("includes every CONTRACT_SNIPPET verbatim", () => {
    const docPath = join(__dirname, "..", "..", "docs", "website-magic-link-rate-limit.md");
    const body = readFileSync(docPath, "utf8");
    for (const s of CONTRACT_SNIPPETS) {
      expect(body, `missing snippet: ${s.slice(0, 60)}…`).toContain(s);
    }
  });
});
