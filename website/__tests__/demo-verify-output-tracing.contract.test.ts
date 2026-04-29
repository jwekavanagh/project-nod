import { existsSync, globSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS } from "@/lib/demoVerifyOutputFileTracingGlobs";

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("demo verify serverless file tracing contract", () => {
  it("every declared glob resolves to at least one file on disk", () => {
    for (const pattern of DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS) {
      const matches = globSync(pattern, { cwd: websiteRoot });
      expect(matches.length, `pattern matched nothing: ${pattern}`).toBeGreaterThan(0);
      for (const rel of matches) {
        const abs = path.resolve(websiteRoot, rel);
        expect(existsSync(abs), `missing file for glob hit: ${abs}`).toBe(true);
      }
    }
  });

  it("next.config wires outputFileTracingIncludes to the shared glob list", () => {
    const nextConfigPath = path.join(websiteRoot, "next.config.ts");
    const src = readFileSync(nextConfigPath, "utf8");
    expect(src).toContain("demoVerifyOutputFileTracingGlobs");
    expect(src).toContain('"/api/demo/verify"');
    expect(src).toContain('"/api/verify"');
    expect(src).toContain("outputFileTracingIncludes");
  });

  it("root package.json lists schemas/ in npm files so agentskeptic installs ship schema JSON", () => {
    const pkgPath = path.join(websiteRoot, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { files?: string[] };
    expect(pkg.files, "package.json missing files[]").toBeDefined();
    expect(pkg.files).toContain("schemas/");
  });
});
