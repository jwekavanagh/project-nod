# Bootstrap pack (normative)

Single source of truth for the **`agentskeptic bootstrap`** subcommand: flags, stdin/stdout/stderr, exit codes, input/output contracts, staging rules, and trust inheritance from Quick Verify and batch verify.

**Audience:** engineers implementing or testing the CLI; integrators using bootstrap to obtain a first contract pack without hand-authoring `tools.json` or production `events.ndjson`.

**Not in scope:** unstructured log ingestion. Bootstrap accepts only **`BootstrapPackInput` v1** (JSON). Arbitrary text logs remain out of scope per [verification-product-ssot.md](verification-product-ssot.md).

**Authority:** Quick inference thresholds and export bytes identity remain in [quick-verify-normative.md](quick-verify-normative.md). Batch verify semantics and `WorkflowResult` shape remain in [agentskeptic.md](agentskeptic.md); this document links to those sources and does not duplicate numeric ladders.

---

## CLI invocation

```text
agentskeptic bootstrap --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>
```

No other flags in v1. **`--help` / `-h`** print usage and exit `0`.

---

## Documentation authority matrix

| Topic | Authoritative location |
|-------|-------------------------|
| `bootstrap` flags, I/O, exit codes, staging, success definition | **This file** |
| `BootstrapPackInput` v1 JSON | This file **Contract appendix** + `schemas/bootstrap-pack-input-v1.schema.json` (schema must not contradict the appendix) |
| Optional hosted registry draft (website API, absolute schema `$ref` / AJV order, commercial harness) | [registry-draft-ssot.md](registry-draft-ssot.md) |
| Quick thresholds, `--export-registry` byte identity | [quick-verify-normative.md](quick-verify-normative.md) |
| `verify` stdout/stderr for `WorkflowResult` | [agentskeptic.md](agentskeptic.md) + shared `runStandardVerifyWorkflowCliFlow` behavior |

---

## Trust inheritance

- **`quick-report.json`** is a full **`QuickVerifyReport`** (schema `quick-verify-report`). Quick Verify remains **provisional**; see `productTruth` in that JSON.
- **Exit `0`** additionally requires in-process contract **`verifyWorkflow`** to return **`status === "complete"`**. That is the only strengthened claim on success.

---

## Staging and `--out` directory

- **`--out`** must **not** exist before invocation (neither file nor directory). If it exists → exit **`3`**, code **`BOOTSTRAP_OUT_EXISTS`**.
- After validation, the implementation creates **`--out`** and writes pack files. On any **non-zero** exit after the directory was created, the implementation **removes** `--out` recursively (best-effort) so partial packs are not left behind.

---

## stdout / stderr (summary)

| Exit | stdout | stderr |
|------|--------|--------|
| `0` | One minified JSON line: **`BootstrapStdoutEnvelope` v1** | Empty |
| `1` | Same as `verify` for `status === "inconsistent"` | Same as `verify` (human truth report + distribution footer) |
| `2a` | Same as `verify` for `status === "incomplete"` | Same as `verify` |
| `2b` | Empty | One line `cliErrorEnvelope` (Quick not pass, or zero exportable tools) |
| `3` | Empty | One line `cliErrorEnvelope` |

Implementation must use **`runStandardVerifyWorkflowCliFlow`** (or equivalent single call path) for exit **`1`** / **`2a`** so stdout/stderr cannot drift from `verify`. Exit **`2b`** and **`3`** use **`writeCliError`** / **`cliErrorEnvelope`** only.

---

## Commercial / OSS

**`bootstrap`** uses the same **`runLicensePreflightIfNeeded("verify")`** path as **`agentskeptic quick`** (no new entitlement dimension in v1).

---

## Contract appendix (normative)

### A. `BootstrapPackInput` v1 (required fields)

Top-level object **must** contain exactly these keys (`additionalProperties: false` on the root in `schemas/bootstrap-pack-input-v1.schema.json`):

```json
{
  "schemaVersion": 1,
  "workflowId": "wf_bootstrap_demo",
  "openaiChatCompletion": {
    "choices": [
      {
        "message": {
          "tool_calls": [
            {
              "id": "call_abc",
              "type": "function",
              "function": {
                "name": "crm.upsert_contact",
                "arguments": "{\"recordId\":\"c_ok\",\"fields\":{\"name\":\"Alice\",\"status\":\"active\"}}"
              }
            }
          ]
        }
      }
    ]
  }
}
```

**Rules:**

- `schemaVersion` **must** be integer `1`. Any other value → exit **`3`**, code **`BOOTSTRAP_INPUT_INVALID`**.
- `workflowId` **must** match `^[a-zA-Z0-9_-]{1,128}$`. Used for synthetic Quick input association, emitted `events.ndjson`, and **`verifyWorkflow`**.
- `openaiChatCompletion.choices` **must** be a non-empty array. Only **`choices[0].message.tool_calls`** is read; other properties are ignored unless required shapes below fail.
- `tool_calls` **must** be a non-empty array. Empty → exit **`3`**, **`BOOTSTRAP_NO_TOOL_CALLS`**.
- Each element **must** have:
  - `id`: string, length ≥ 1
  - `type`: string, **must equal** `"function"` (case-sensitive)
  - `function`: object with `name` (string, length ≥ 1) and `arguments` (string)
- `function.arguments` **must** parse with `JSON.parse` to a **plain object** (not `null`, not array). Failure → exit **`3`**, **`BOOTSTRAP_TOOL_CALL_ARGUMENTS_INVALID`**, message suffix `(tool_calls[i] i=<0-based index>)`.

### B. Synthesized Quick input (exact line shape)

For each `tool_calls[i]` in array order, output **one** NDJSON line (UTF-8). Final file ends with a trailing newline on the last line.

```json
{"tool_calls":[{"id":"<id>","type":"function","function":{"name":"<name>","arguments":"<arguments verbatim>"}}]}
```

Placeholders are copied from the validated input without transformation. **No** other line format is permitted.

### C. Pack outputs under `--out`

| File | Definition |
|------|------------|
| `tools.json` | Byte-identical to Quick’s `--export-registry` output for this run (registry array UTF-8). |
| `events.ndjson` | Output of `buildQuickContractEventsNdjson` using **`workflowId`** from input and Quick `contractExports`. |
| `quick-report.json` | Full **`QuickVerifyReport`**: same serialization as **`agentskeptic quick`** stdout payload (`stableStringify(report)` + single trailing newline). |
| `README.bootstrap.md` | Fixed template (see implementation constant): states Quick is provisional and gives one **`agentskeptic verify`** example using **`./events.ndjson`** and **`./tools.json`**. |

### D. `BootstrapStdoutEnvelope` v1 (exit 0 only)

Single stdout line: **minified** JSON (no pretty-print):

```json
{"schemaVersion":1,"kind":"agentskeptic_bootstrap_result","workflowId":"<same>","outDir":"<resolved absolute path>","quickVerdict":"pass","verifyStatus":"complete","exportedToolCount":<number>}
```

### E. Exit code table (authoritative)

| Code | Condition | stdout | stderr |
|------|------------|--------|--------|
| 0 | Quick `verdict === "pass"` **and** `contractExports.length > 0` **and** `verifyWorkflow` returns `status === "complete"` | `BootstrapStdoutEnvelope` one line | empty |
| 1 | `verifyWorkflow` returned `status === "inconsistent"` | Same as `verify` | Same as `verify` |
| 2a | `verifyWorkflow` returned `status === "incomplete"` | Same as `verify` | Same as `verify` |
| 2b | Quick `verdict !== "pass"` **or** `contractExports.length === 0` (verify not reached) | empty | one `cliErrorEnvelope` |
| 3 | Usage, input invalid, `out` exists, parse errors, throws before valid `WorkflowResult`, DB failures, license preflight denial | empty | one `cliErrorEnvelope` |

**Codes (stderr envelope) for exit 3:** `BOOTSTRAP_USAGE`, `BOOTSTRAP_INPUT_INVALID`, `BOOTSTRAP_OUT_EXISTS`, `BOOTSTRAP_NO_TOOL_CALLS`, `BOOTSTRAP_TOOL_CALL_ARGUMENTS_INVALID`, plus existing operational codes from shared helpers (e.g. `SQLITE_DATABASE_OPEN_FAILED`).

**Codes for exit 2b:** `BOOTSTRAP_QUICK_NOT_PASS`, `BOOTSTRAP_NO_EXPORTABLE_TOOLS`.

---

## Operational codes (bootstrap-specific)

| Code | Typical exit |
|------|----------------|
| `BOOTSTRAP_USAGE` | 3 |
| `BOOTSTRAP_INPUT_INVALID` | 3 |
| `BOOTSTRAP_OUT_EXISTS` | 3 |
| `BOOTSTRAP_NO_TOOL_CALLS` | 3 |
| `BOOTSTRAP_TOOL_CALL_ARGUMENTS_INVALID` | 3 |
| `BOOTSTRAP_QUICK_NOT_PASS` | 2 |
| `BOOTSTRAP_NO_EXPORTABLE_TOOLS` | 2 |
