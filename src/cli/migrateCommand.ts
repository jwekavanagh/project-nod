import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEPRECATED_CALLS = new Set([
  "createDecisionGate",
  "verifyAgentskeptic",
  "verifyWorkflow",
  "runQuickVerify",
  "runQuickVerifyToValidatedReport",
  "assertLangGraphCheckpointProductionGate",
  "createLangGraphCheckpointTrustGate",
]);

function walk(dir: string, out: string[]): void {
  let dirents: import("node:fs").Dirent[];
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of dirents) {
    const p = join(dir, ent.name);
    const name = ent.name;
    if (ent.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === ".git" || name === "website") continue;
      walk(p, out);
    } else if (ent.isFile() && /\.(ts|tsx|mts|cts)$/.test(name)) {
      out.push(p);
    }
  }
}

/**
 * Scans for deprecated v1 API call expressions. With `--write`, appends a one-line migration hint to the file
 * once (marker `// @agentskeptic-migrate processed`) — conservative; full AST rewrites are manual (see docs/migrate-2.md).
 */
export function runMigrateCommand(args: string[]): void {
  const paths = args.filter((a) => !a.startsWith("-") && a.length > 0);
  const root = paths[0] ?? ".";
  const write = args.includes("--write");
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`Usage: agentskeptic migrate [rootDir] [--write]

Reports lines referencing removed root APIs that should migrate to AgentSkeptic (see docs/migrate-2.md).
With --write, marks each file once with a comment pointing at docs/migrate-2.md (does not rewrite call sites).

`);
    process.exit(0);
  }

  const files: string[] = [];
  walk(root, files);

  const matches: { file: string; line: number; name: string }[] = [];
  for (const abs of files) {
    /** skip obvious generated */
    const baseName = abs.split(/[/\\]/).pop() ?? "";
    if (baseName.endsWith(".generated.ts")) continue;

    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] ?? "";
      for (const name of DEPRECATED_CALLS) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\\b${escaped}\\s*\\(`);
        if (re.test(lineText)) matches.push({ file: abs, line: i + 1, name });
      }
    }
  }

  for (const m of matches) {
    process.stdout.write(`${m.file}:${m.line}: ${m.name}\n`);
  }

  if (write && matches.length > 0) {
    const touched = new Set<string>();
    for (const m of matches) touched.add(m.file);
    for (const file of touched) {
      let text = readFileSync(file, "utf8");
      if (text.includes("@agentskeptic-migrate processed") || text.includes("@agentskeptic-migrate-v2 processed"))
        continue;
      const banner = `\n// @agentskeptic-migrate processed — see docs/migrate-2.md for AgentSkeptic v4 API mapping.\n`;
      writeFileSync(file, text.trimEnd() + banner, "utf8");
    }
  }

  process.stdout.write(`Found ${matches.length} deprecated call site(s).\n`);
  process.exit(0);
}
