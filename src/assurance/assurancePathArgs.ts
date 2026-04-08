import path from "node:path";

/** CLI flags whose following argument is a filesystem path (resolved relative to manifest dir). */
export const ASSURANCE_PATH_FLAGS = new Set([
  "--events",
  "--registry",
  "--db",
  "--expect-lock",
  "--prior",
  "--current",
  "--input",
  "--export-registry",
  "--emit-events",
  "--output-lock",
]);

/**
 * Returns a copy of argv with path arguments resolved to absolute paths.
 * Relative segments are resolved from `manifestDir`.
 */
export function resolveSpawnArgvPaths(argv: string[], manifestDir: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    out.push(a);
    if (i + 1 >= argv.length) break;
    if (!ASSURANCE_PATH_FLAGS.has(a)) continue;
    const next = argv[i + 1]!;
    if (next.startsWith("-")) continue;
    if (path.isAbsolute(next)) {
      i++;
      out.push(next);
      continue;
    }
    const abs = path.resolve(manifestDir, next);
    i++;
    out.push(abs);
  }
  return out;
}

/** Paths that must exist before spawn (excludes paths that are outputs). */
export function collectPathArgsForPreflight(argv: string[]): string[] {
  const paths: string[] = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (ASSURANCE_PATH_FLAGS.has(argv[i]!)) {
      const next = argv[i + 1]!;
      if (!next.startsWith("-")) paths.push(next);
    }
  }
  return paths;
}
