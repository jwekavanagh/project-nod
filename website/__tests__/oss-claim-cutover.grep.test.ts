import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("OSS claim cutover (no sessionStorage / same_browser handoff)", () => {
  it("OssClaimClient has no forbidden substrings", () => {
    const src = read("src/components/OssClaimClient.tsx");
    expect(src).not.toMatch(/sessionStorage/);
    expect(src).not.toMatch(/same_browser/);
    expect(src).not.toMatch(/OSS_CLAIM_STORAGE_KEY/);
    expect(src).not.toMatch(/ossClaimSessionStorageKey/);
  });

  it("OSS claim lib modules have no forbidden substrings", () => {
    const paths = [
      "src/lib/ossClaimPendingCookie.ts",
      "src/lib/ossClaimRateLimits.ts",
      "src/lib/ossClaimSecretHash.ts",
      "src/lib/ossClaimTicketPayload.ts",
      "src/lib/ossClaimTicketTtl.ts",
    ];
    for (const p of paths) {
      const s = read(p);
      expect(s, p).not.toMatch(/sessionStorage/);
      expect(s, p).not.toMatch(/same_browser/);
      expect(s, p).not.toMatch(/OSS_CLAIM_STORAGE_KEY/);
    }
  });
});
