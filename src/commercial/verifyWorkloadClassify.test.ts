import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyBatchVerifyWorkload,
  classifyQuickVerifyWorkload,
} from "./verifyWorkloadClassify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("classifyBatchVerifyWorkload", () => {
  const repoRoot = path.resolve(__dirname, "..", "..");

  it("returns non_bundled for postgres", () => {
    expect(
      classifyBatchVerifyWorkload({
        eventsPath: path.join(repoRoot, "examples", "events.ndjson"),
        registryPath: path.join(repoRoot, "examples", "tools.json"),
        database: { kind: "postgres", connectionString: "postgresql://x" },
      }),
    ).toBe("non_bundled");
  });

  it("returns bundled_examples when all paths are bundled examples", () => {
    expect(
      classifyBatchVerifyWorkload({
        eventsPath: path.join(repoRoot, "examples", "events.ndjson"),
        registryPath: path.join(repoRoot, "examples", "tools.json"),
        database: { kind: "sqlite", path: path.join(repoRoot, "examples", "demo.db") },
      }),
    ).toBe("bundled_examples");
  });

  it("returns non_bundled when events path is outside bundled list", () => {
    expect(
      classifyBatchVerifyWorkload({
        eventsPath: path.join(repoRoot, "test", "fixtures", "x.ndjson"),
        registryPath: path.join(repoRoot, "examples", "tools.json"),
        database: { kind: "sqlite", path: path.join(repoRoot, "examples", "demo.db") },
      }),
    ).toBe("non_bundled");
  });
});

describe("classifyQuickVerifyWorkload", () => {
  const repoRoot = path.resolve(__dirname, "..", "..");

  it("returns non_bundled for stdin input", () => {
    expect(
      classifyQuickVerifyWorkload({
        inputPath: "-",
        sqlitePath: path.join(repoRoot, "examples", "demo.db"),
      }),
    ).toBe("non_bundled");
  });

  it("returns non_bundled when postgres URL set", () => {
    expect(
      classifyQuickVerifyWorkload({
        inputPath: path.join(repoRoot, "examples", "events.ndjson"),
        postgresUrl: "postgresql://localhost/x",
      }),
    ).toBe("non_bundled");
  });
});
