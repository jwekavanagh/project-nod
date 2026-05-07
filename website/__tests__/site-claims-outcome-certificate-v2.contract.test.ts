import { expect, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";

const ROOT = getRepoRoot();
const WEBSITE = join(ROOT, "website");

/** Exact substring assertions per rollout plan — case-sensitive. */
const GUIDES: Array<{ path: string; needles: string[] }> = [
  {
    path: "website/content/surfaces/guides/buyer-trust-production-implications.md",
    needles: ["evidenceCompleteness", "schemaVersion: 3"],
  },
  {
    path: "website/content/surfaces/guides/first-run-verification.md",
    needles: ["agentskeptic quick", "evidenceCompleteness"],
  },
  {
    path: "website/content/surfaces/guides/pre-production-read-only-sql-gate.md",
    needles: ["Outcome Certificate v3", "schemaVersion: 3"],
  },
  {
    path: "website/content/surfaces/guides/ai-agent-wrong-crm-data.md",
    needles: ["evidenceCompleteness block on quick stdout"],
  },
  {
    path: "website/content/surfaces/guides/trace-green-postgres-row-missing.md",
    needles: ["Outcome Certificate v3", "evidenceCompleteness**) so operators"],
  },
  {
    path: "website/content/surfaces/guides/verify-langgraph-workflows.md",
    needles: ["schemaVersion: 3"],
  },
];

describe("site copy — outcome certificate v2 + beacon vocabulary", () => {
  it("guides six-pack includes mandated substrings", () => {
    for (const g of GUIDES) {
      const abs = join(ROOT, g.path);
      const body = readFileSync(abs, "utf8");
      for (const n of g.needles) {
        expect(body, `${g.path} must contain ${JSON.stringify(n)}`).toContain(n);
      }
    }
  });

  it("website/content has no stale outcome_certificate_v1 label", () => {
    const files = globSync("content/**/*.{md,mdx}", { cwd: WEBSITE, posix: false });
    for (const f of files) {
      const abs = join(WEBSITE, f);
      const body = readFileSync(abs, "utf8");
      expect(body).not.toContain("outcome_certificate_v1");
    }
  });

  it("website/src/app production TS/TSX has no outcome_certificate_v1 label", () => {
    const files = [
      ...globSync("src/app/**/*.tsx", { cwd: WEBSITE }),
      ...globSync("src/app/**/*.ts", { cwd: WEBSITE }),
    ].filter((f) => !f.replaceAll("\\", "/").includes("__tests__/"));
    for (const f of files) {
      const abs = join(WEBSITE, f);
      const body = readFileSync(abs, "utf8");
      expect(body).not.toContain("outcome_certificate_v1");
    }
  });
});
