import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "content", "surfaces", "guides");

describe("buyer authority surfaces (synced markdown)", () => {
  const cases: { file: string; requiredHeadings: string[] }[] = [
    {
      file: "buyer-commercial-boundary.md",
      requiredHeadings: ["## Commercial boundary", "## Evaluation path", "## What to do next"],
    },
    {
      file: "buyer-ci-enforcement-metering.md",
      requiredHeadings: ["## CI enforcement and metering", "## What to do next"],
    },
    {
      file: "buyer-trust-production-implications.md",
      requiredHeadings: ["## Trust and production implications", "## What to do next"],
    },
  ];

  it.each(cases)("includes required headings in $file", ({ file, requiredHeadings }) => {
    const raw = readFileSync(join(root, file), "utf8");
    for (const h of requiredHeadings) {
      expect(raw).toContain(h);
    }
    expect(raw).toMatch(/]\(\/integrate\)/);
    expect(raw).toMatch(/]\(\/pricing\)/);
    expect(raw).toMatch(/]\(\/security\)/);
  });
});
