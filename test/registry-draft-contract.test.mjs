/**
 * Registry-draft request schema + normalization (docs/registry-draft.md).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("registry-draft contract", async () => {
  const {
    getRegistryDraftRequestValidator,
    getBootstrapPackInputValidator,
    parseAndNormalizeRegistryDraftRequest,
    normalizeOpenAiToolCallsToBootstrapPackInput,
  } = await import(pathToFileURL(join(root, "dist", "registryDraft", "index.js")).href);

  it("validates branch-B envelope and matches normalized golden", () => {
    const envelope = JSON.parse(
      readFileSync(join(root, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8"),
    );
    const golden = JSON.parse(
      readFileSync(join(root, "test", "fixtures", "registry-draft", "normalized-bootstrap-golden.json"), "utf8"),
    );

    const vReq = getRegistryDraftRequestValidator();
    const vBoot = getBootstrapPackInputValidator();
    assert.ok(vReq(envelope), JSON.stringify(vReq.errors));

    const norm = normalizeOpenAiToolCallsToBootstrapPackInput({
      workflowId: envelope.workflowId,
      tool_calls: envelope.tool_calls,
    });
    assert.deepEqual(norm, golden);

    const parsed = parseAndNormalizeRegistryDraftRequest(envelope, vReq, vBoot);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.normalizedBootstrapPackInput, golden);
  });

  it("rejects ddlHint containing scheme delimiter", () => {
    const vReq = getRegistryDraftRequestValidator();
    const bad = {
      inputKind: "openai_tool_calls_v1",
      schemaVersion: 1,
      workflowId: "wf_x",
      ddlHint: "postgres://localhost/db",
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "n", arguments: "{}" },
        },
      ],
    };
    assert.equal(vReq(bad), false);
  });
});
