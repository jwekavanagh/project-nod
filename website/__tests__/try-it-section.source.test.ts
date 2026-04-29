import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("HomeVerifyCta.tsx", () => {
  const src = readFileSync(
    path.join(__dirname, "..", "src", "app", "home", "HomeVerifyCta.tsx"),
    "utf8",
  );

  it("is a CTA-only section linked to /verify", () => {
    expect(src).toContain('id="try-it"');
    expect(src).toContain("data-testid={productCopy.uiTestIds.tryIt}");
    expect(src).toContain('Link href="/verify"');
    expect(src).not.toContain("/api/demo/verify");
  });
});
