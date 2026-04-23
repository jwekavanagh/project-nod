/**
 * ADOPTION_EPISTEMICS_CONTRACT — commercial verdict shape, anchor SSOT links, epistemic-contract canonical headings.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ANCHOR_DOCS = [
  "docs/funnel-observability.md",
  "docs/growth-metrics.md",
  "docs/commercial.md",
  "docs/first-run-integration.md",
  "docs/golden-path.md",
  "docs/verification-product.md",
];

const LINK_ADOPTION = "adoption-epistemics.md";
const LINK_EPISTEMIC = "epistemic-contract.md";

describe("adoption epistemics contract", () => {
  it("commercial_validation_verdict_layers_shape", () => {
    const raw = readFileSync(join(root, "artifacts", "commercial-validation-verdict.json"), "utf8");
    const v = JSON.parse(raw);
    assert.equal(v.schemaVersion, 1);
    assert.ok(v.layers && typeof v.layers === "object");
    assert.ok("regression" in v.layers);
    assert.ok("playwrightCommercialE2e" in v.layers);
    assert.equal("funnel" in v.layers, false);
    assert.equal(typeof v.layers.regression, "boolean");
    assert.equal(typeof v.layers.playwrightCommercialE2e, "boolean");
  });

  it("anchor_docs_link_adoption_epistemics", () => {
    for (const rel of ANCHOR_DOCS) {
      const body = readFileSync(join(root, rel), "utf8");
      assert.ok(body.includes(LINK_ADOPTION), `${rel} must link to ${LINK_ADOPTION}`);
    }
  });

  it("anchor_docs_link_epistemic_contract", () => {
    for (const rel of ANCHOR_DOCS) {
      const body = readFileSync(join(root, rel), "utf8");
      assert.ok(body.includes(LINK_EPISTEMIC), `${rel} must link to ${LINK_EPISTEMIC}`);
    }
  });

  it("epistemic_contract_canonical_headings", () => {
    const body = readFileSync(join(root, "docs", "epistemic-contract.md"), "utf8");
    assert.equal(
      body.split("## First necessary constraint on grounded output (formal property)").length - 1,
      1,
      "exactly one first-necessary-constraint heading in epistemic-contract.md",
    );
    assert.equal(
      body.split("## Structural vs empirical vs telemetry proxies").length - 1,
      1,
      "exactly one telemetry proxies heading in epistemic-contract.md",
    );
    for (const s of ["integrator-owned", "correctly-shaped", "cannot be ranked from this repository"]) {
      assert.ok(body.includes(s), `docs/epistemic-contract.md must contain ${JSON.stringify(s)}`);
    }
    assert.ok(
      body.includes("**Dominant real-world drop-off:**"),
      "dominant drop-off subsection must remain in epistemic-contract.md",
    );
  });

  it("cross_doc_links_to_epistemic_contract_for_ranking_context", () => {
    const frag = "epistemic-contract.md";
    for (const rel of ["docs/first-run-integration.md", "docs/growth-metrics.md"]) {
      const body = readFileSync(join(root, rel), "utf8");
      assert.ok(body.includes(frag), `${rel} must reference ${frag}`);
    }
    const vp = readFileSync(join(root, "docs", "verification-product.md"), "utf8");
    assert.ok(
      vp.includes("**Epistemic contract**") && vp.includes("epistemic-contract.md"),
      "verification-product SSOT authority matrix must name epistemic-contract.md",
    );
  });
});
