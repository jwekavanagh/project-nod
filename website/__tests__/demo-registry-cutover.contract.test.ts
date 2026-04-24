import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const websiteRoot = join(__dirname, "..");
const websiteSrc = join(websiteRoot, "src");

function walkDir(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkDir(p, acc);
    else if (s.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) acc.push(p);
  }
  return acc;
}

describe("demo registry cutover", () => {
  it("does not ship demoScenarioIds.ts", () => {
    expect(existsSync(join(websiteSrc, "lib", "demoScenarioIds.ts"))).toBe(false);
  });

  it("no demoScenarioIds substring in website src", () => {
    const files = walkDir(websiteSrc);
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toContain("demoScenarioIds");
    }
  });

  it("user-facing try-it sources do not claim exactly three scenarios", () => {
    const checkPaths = [
      join(websiteRoot, "src", "content", "productCopy.ts"),
      join(websiteRoot, "src", "app", "page.tsx"),
      join(websiteRoot, "src", "app", "integrate", "page.tsx"),
    ];
    for (const p of checkPaths) {
      const t = readFileSync(p, "utf8");
      expect(t, p).not.toMatch(/three bundled scenarios?/i);
      expect(t, p).not.toMatch(/3 bundled scenarios?/i);
    }
  });
});
