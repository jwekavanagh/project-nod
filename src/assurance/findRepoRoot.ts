import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Walks parents from `startDir` to find the workflow-verifier package root
 * (directory containing package.json with name "workflow-verifier").
 */
export function findWorkflowVerifierRepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const pkg = path.join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const j = JSON.parse(readFileSync(pkg, "utf8")) as { name?: string };
        if (j.name === "workflow-verifier") return dir;
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
