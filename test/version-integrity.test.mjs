/**
 * assert-version-integrity: happy path (real repo) and controlled drift (temp root).
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parse as parseYaml } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const OPENAPI_SNIPPET = `openapi: "3.0.3"
info:
  title: t
  version: "2.0.0"
paths: {}
`;

const PUBLIC_GEN_SNIPPET = `// Generated
export const AGENTSKEPTIC_CLI_SEMVER = "2.0.0";
`;

function writeTree(tmp, badWebsite) {
  const webVer = badWebsite ? "0.0.0-wrong" : "2.0.0";
  for (const d of ["python", "website", "src", "schemas"]) {
    mkdirSync(join(tmp, d), { recursive: true });
  }
  writeFileSync(
    join(tmp, "package.json"),
    JSON.stringify({ name: "fixture", version: "2.0.0" }, null, 2) + "\n",
  );
  writeFileSync(
    join(tmp, "python", "pyproject.toml"),
    '[project]\nname = "a"\nversion = "2.0.0"\n',
  );
  writeFileSync(
    join(tmp, "website", "package.json"),
    JSON.stringify({ name: "w", version: webVer }, null, 2) + "\n",
  );
  writeFileSync(join(tmp, "src", "publicDistribution.generated.ts"), PUBLIC_GEN_SNIPPET);
  writeFileSync(join(tmp, "schemas", "openapi-commercial-v1.yaml"), OPENAPI_SNIPPET);
}

describe("version integrity", () => {
  it("passes on a clean repository tree (T1)", () => {
    const out = execFileSync(
      process.execPath,
      [join(root, "scripts", "assert-version-integrity.mjs")],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(out, "");
  });

  it("OpenAPI info.version matches root package.json in repo (T3)", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const oap = readFileSync(join(root, "schemas", "openapi-commercial-v1.yaml"), "utf8");
    const doc = parseYaml(oap);
    assert.equal(String(/** @type {any} */ (doc).info?.version), String(pkg.version));
  });

  it("fails when one allowlisted file drifts (T2)", () => {
    const tmp = mkdtempSync(join(tmpdir(), "avi-"));
    writeTree(tmp, true);
    let threw = false;
    let errText = "";
    try {
      execFileSync(process.execPath, [join(root, "scripts", "assert-version-integrity.mjs"), tmp], {
        encoding: "utf8",
      });
    } catch (e) {
      threw = true;
      const ne = /** @type {Error & { status?: number; stdout?: string; stderr?: string }} */ (e);
      errText = (ne.stdout || "") + (ne.stderr || "") + (ne.message || "");
    }
    assert.equal(threw, true);
    assert.ok(errText.length > 0, "expected output from assert-version-integrity on drift");
  });
});
