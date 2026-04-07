import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const EMITTER_FILES = [
  "reconciler.ts",
  "multiEffectRollup.ts",
  "relationalInvariant.ts",
  "verificationPolicy.ts",
  "resolveExpectation.ts",
  "pipeline.ts",
  "registryValidation.ts",
];

const CODE_STRING_LITERAL = /\bcode\s*:\s*"([A-Z][A-Z0-9_]*)"/g;

function stripWholeLineComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      return !t.startsWith("//");
    })
    .join("\n");
}

describe("wireReasonEmittersGuard", () => {
  it("emitter files contain no code: \"UPPER_SNAKE\" property literals", () => {
    for (const rel of EMITTER_FILES) {
      const p = path.join(root, "src", rel);
      const raw = readFileSync(p, "utf8");
      const body = stripWholeLineComments(raw);
      const matches = [...body.matchAll(CODE_STRING_LITERAL)];
      expect(matches, rel).toEqual([]);
    }
  });
});
