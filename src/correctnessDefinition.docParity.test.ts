import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CD_DOC_ANCHORS, CORRECTNESS_ENFORCEMENT_KINDS } from "./correctnessDefinitionTemplates.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const normativePath = path.join(root, "docs", "correctness-definition-normative.md");

describe("correctness definition normative doc parity", () => {
  it("docs/correctness-definition-normative.md lists every CD_DOC_ANCHORS id", () => {
    const doc = readFileSync(normativePath, "utf8");
    for (const id of CD_DOC_ANCHORS) {
      expect(doc, `missing anchor ${id}`).toContain(id);
    }
  });

  it("docs/correctness-definition-normative.md mentions every enforcementKind literal", () => {
    const doc = readFileSync(normativePath, "utf8");
    for (const kind of CORRECTNESS_ENFORCEMENT_KINDS) {
      expect(doc, `missing enforcementKind ${kind}`).toContain(kind);
    }
  });
});
