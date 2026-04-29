import { existsSync, globSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ACCOUNT_PAGE_OUTPUT_FILE_TRACING_GLOBS } from "@/lib/accountPageFileTracingGlobs";

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("account page serverless file tracing contract", () => {
  it("every declared glob resolves to commercial SSOT JSON on disk", () => {
    for (const pattern of ACCOUNT_PAGE_OUTPUT_FILE_TRACING_GLOBS) {
      const matches = globSync(pattern, { cwd: websiteRoot });
      expect(matches.length, `pattern matched nothing: ${pattern}`).toBeGreaterThan(0);
      for (const rel of matches) {
        const abs = path.resolve(websiteRoot, rel);
        expect(existsSync(abs), `missing file for glob hit: ${abs}`).toBe(true);
      }
    }
  });

  it("next.config includes /account tracing for commercial plans JSON", () => {
    const nextConfigPath = path.join(websiteRoot, "next.config.ts");
    const src = readFileSync(nextConfigPath, "utf8");
    expect(src).toContain("accountPageFileTracingGlobs");
    expect(src).toContain('"/account"');
    expect(src).toContain("outputFileTracingIncludes");
  });
});
