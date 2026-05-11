import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_OPERATIONAL_CODES } from "./failureCatalog.js";
import { loadSchemaValidator } from "./schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const fixtures = join(root, "test/fixtures/certificate-diff/cases");

describe("CLI compare certificates", () => {
  it("success A: stdout verifies verification-diff schema; stderr is human text", () => {
    const beforePath = join(fixtures, "A.less_determinate.before.json");
    const afterPath = join(fixtures, "A.less_determinate.after.json");
    const proc = spawnSync(
      process.execPath,
      ["--no-warnings", cliJs, "compare", "certificates", "--before", beforePath, "--after", afterPath],
      { encoding: "utf8", cwd: root },
    );
    expect(proc.status, proc.stderr).toBe(0);
    const v = loadSchemaValidator("verification-diff-certificate-v1");
    expect(v(JSON.parse(proc.stdout.trim()))).toBe(true);
    expect(proc.stderr).toContain("verification_diff_certificate:");
    expect(proc.stderr).toContain("Posture classification: less_determinate");
    try {
      JSON.parse(proc.stderr.trim());
      expect.fail("stderr must not be JSON on success");
    } catch {
      /* expected */
    }
  });

  it("success B: improved posture", () => {
    const proc = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "compare",
        "certificates",
        "--before",
        join(fixtures, "B.improved.before.json"),
        "--after",
        join(fixtures, "B.improved.after.json"),
      ],
      { encoding: "utf8", cwd: root },
    );
    expect(proc.status, proc.stderr).toBe(0);
    expect(JSON.parse(proc.stdout.trim()).postureMovement).toBe("improved");
  });

  it("USAGE when --before without compare certificates", () => {
    const proc = spawnSync(
      process.execPath,
      ["--no-warnings", cliJs, "compare", "--before", join(fixtures, "B.improved.before.json")],
      { encoding: "utf8", cwd: root },
    );
    expect(proc.status).toBe(3);
    expect(proc.stdout.trim()).toBe("");
    const err = JSON.parse(proc.stderr.trim()) as { code: string };
    expect(err.code).toBe(CLI_OPERATIONAL_CODES.COMPARE_USAGE);
  });

  it("USAGE when combining certificates with --manifest", () => {
    const manifest = join(root, "test", "fixtures", "debug-ui-compare", "compare-manifest.json");
    const proc = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "compare",
        "certificates",
        "--before",
        join(fixtures, "B.improved.before.json"),
        "--after",
        join(fixtures, "B.improved.after.json"),
        "--manifest",
        manifest,
      ],
      { encoding: "utf8", cwd: root },
    );
    expect(proc.status).toBe(3);
    expect(proc.stdout.trim()).toBe("");
    const err = JSON.parse(proc.stderr.trim()) as { code: string };
    expect(err.code).toBe(CLI_OPERATIONAL_CODES.COMPARE_USAGE);
  });

  it("COMPARE_WORKFLOW_ID_MISMATCH exit 3 empty stdout", () => {
    const dir = join(tmpdir(), `cmp-cert-wf-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const a = JSON.parse(readFileSync(join(fixtures, "B.improved.before.json"), "utf8")) as Record<
        string,
        unknown
      >;
      writeFileSync(join(dir, "a.json"), JSON.stringify(a));
      writeFileSync(join(dir, "b.json"), JSON.stringify({ ...a, workflowId: "other" }));
      const proc = spawnSync(
        process.execPath,
        ["--no-warnings", cliJs, "compare", "certificates", "--before", join(dir, "a.json"), "--after", join(dir, "b.json")],
        { encoding: "utf8", cwd: root },
      );
      expect(proc.status).toBe(3);
      expect(proc.stdout.trim()).toBe("");
      const err = JSON.parse(proc.stderr.trim()) as { code: string; message: string };
      expect(err.code).toBe(CLI_OPERATIONAL_CODES.COMPARE_WORKFLOW_ID_MISMATCH);
      expect(err.message).toContain("workflowId differs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("COMPARE_INPUT_JSON_SYNTAX prior prefix", () => {
    const dir = join(tmpdir(), `cmp-cert-json-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, "bad.json"), "{");
      writeFileSync(join(dir, "ok.json"), readFileSync(join(fixtures, "B.improved.after.json"), "utf8"));
      const proc = spawnSync(
        process.execPath,
        [
          "--no-warnings",
          cliJs,
          "compare",
          "certificates",
          "--before",
          join(dir, "bad.json"),
          "--after",
          join(dir, "ok.json"),
        ],
        { encoding: "utf8", cwd: root },
      );
      expect(proc.status).toBe(3);
      expect(proc.stdout.trim()).toBe("");
      const err = JSON.parse(proc.stderr.trim()) as { code: string; message: string };
      expect(err.code).toBe(CLI_OPERATIONAL_CODES.COMPARE_INPUT_JSON_SYNTAX);
      expect(err.message.startsWith("prior:")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("COMPARE_INPUT_SCHEMA_INVALID prior prefix", () => {
    const dir = join(tmpdir(), `cmp-cert-sch-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const a = JSON.parse(readFileSync(join(fixtures, "B.improved.before.json"), "utf8")) as Record<
        string,
        unknown
      >;
      delete a.evidenceCompleteness;
      writeFileSync(join(dir, "bad.json"), JSON.stringify(a));
      writeFileSync(join(dir, "ok.json"), readFileSync(join(fixtures, "B.improved.after.json"), "utf8"));
      const proc = spawnSync(
        process.execPath,
        [
          "--no-warnings",
          cliJs,
          "compare",
          "certificates",
          "--before",
          join(dir, "bad.json"),
          "--after",
          join(dir, "ok.json"),
        ],
        { encoding: "utf8", cwd: root },
      );
      expect(proc.status).toBe(3);
      expect(proc.stdout.trim()).toBe("");
      const err = JSON.parse(proc.stderr.trim()) as { code: string; message: string };
      expect(err.code).toBe(CLI_OPERATIONAL_CODES.COMPARE_INPUT_SCHEMA_INVALID);
      expect(err.message.startsWith("prior:")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
