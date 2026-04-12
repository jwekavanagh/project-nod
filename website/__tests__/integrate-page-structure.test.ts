import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("/integrate page source", () => {
  it("wraps the full integration guide in details without default open", () => {
    const src = readFileSync(
      path.join(__dirname, "..", "src", "app", "integrate", "page.tsx"),
      "utf8",
    );
    expect(src).toContain("<details");
    expect(src).not.toMatch(/<details[^>]*\bopen\b/);
  });
});
