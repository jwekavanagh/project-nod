import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getBootstrapPackInputValidator,
  getRegistryDraftRequestValidator,
  normalizeOpenAiToolCallsToBootstrapPackInput,
  parseAndNormalizeRegistryDraftRequest,
} from "@/lib/registry-draft";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("registry-draft contract", () => {
  it("validates branch-B envelope and matches normalized golden", () => {
    const envelope = JSON.parse(
      readFileSync(join(repoRoot, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8"),
    );
    const golden = JSON.parse(
      readFileSync(join(repoRoot, "test", "fixtures", "registry-draft", "normalized-bootstrap-golden.json"), "utf8"),
    );

    const vReq = getRegistryDraftRequestValidator();
    const vBoot = getBootstrapPackInputValidator();
    expect(vReq(envelope)).toBe(true);

    const norm = normalizeOpenAiToolCallsToBootstrapPackInput({
      workflowId: envelope.workflowId,
      tool_calls: envelope.tool_calls,
    });
    expect(norm).toEqual(golden);

    const parsed = parseAndNormalizeRegistryDraftRequest(envelope, vReq, vBoot);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.normalizedBootstrapPackInput).toEqual(golden);
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
    expect(vReq(bad)).toBe(false);
  });
});
