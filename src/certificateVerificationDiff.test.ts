import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import {
  buildVerificationDiffFromOutcomeCertificates,
  stringifyVerificationDiffCertificate,
} from "./certificateVerificationDiff.js";
import type { OutcomeCertificateV3 } from "./outcomeCertificate.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const casesDir = join(root, "test/fixtures/certificate-diff/cases");
const expectedDir = join(root, "test/fixtures/certificate-diff/expected");

const FIXTURE_CASES: { base: string; expectedFile: string }[] = [
  { base: "A.less_determinate", expectedFile: "A.less_determinate.verification-diff.json" },
  { base: "B.improved", expectedFile: "B.improved.verification-diff.json" },
  { base: "C.weakened", expectedFile: "C.weakened.verification-diff.json" },
  { base: "D.improved", expectedFile: "D.improved.verification-diff.json" },
  { base: "E.weakened", expectedFile: "E.weakened.verification-diff.json" },
  { base: "F.rc_improved", expectedFile: "F.rc_improved.verification-diff.json" },
  { base: "G.drifted_runkind", expectedFile: "G.drifted_runkind.verification-diff.json" },
  { base: "H.drifted_evidence", expectedFile: "H.drifted_evidence.verification-diff.json" },
];

describe("certificateVerificationDiff", () => {
  const validateOutcome = loadSchemaValidator("outcome-certificate-v3");
  const validateDiff = loadSchemaValidator("verification-diff-certificate-v1");

  for (const { base, expectedFile } of FIXTURE_CASES) {
    it(`golden ${base}`, () => {
      const before = JSON.parse(readFileSync(join(casesDir, `${base}.before.json`), "utf8")) as unknown;
      const after = JSON.parse(readFileSync(join(casesDir, `${base}.after.json`), "utf8")) as unknown;
      expect(validateOutcome(before), JSON.stringify(validateOutcome.errors)).toBe(true);
      expect(validateOutcome(after), JSON.stringify(validateOutcome.errors)).toBe(true);

      const diff = buildVerificationDiffFromOutcomeCertificates(
        before as OutcomeCertificateV3,
        after as OutcomeCertificateV3,
      );
      expect(validateDiff(diff), JSON.stringify(validateDiff.errors)).toBe(true);

      const expected = readFileSync(join(expectedDir, expectedFile), "utf8").trim();
      expect(stringifyVerificationDiffCertificate(diff)).toBe(expected);
    });
  }

  it("workflowId mismatch throws TruthLayerError COMPARE_WORKFLOW_ID_MISMATCH", () => {
    const a = JSON.parse(
      readFileSync(join(casesDir, "A.less_determinate.before.json"), "utf8"),
    ) as OutcomeCertificateV3;
    const b = { ...a, workflowId: "other_wf" } as OutcomeCertificateV3;
    try {
      buildVerificationDiffFromOutcomeCertificates(a, b);
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TruthLayerError);
      const err = e as TruthLayerError;
      expect(err.code).toBe(CLI_OPERATIONAL_CODES.COMPARE_WORKFLOW_ID_MISMATCH);
      expect(err.message).toBe(
        "Compare certificates: workflowId differs (before=wf_fixture_diff, after=other_wf).",
      );
    }
  });
});
