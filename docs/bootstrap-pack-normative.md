# Activate / bootstrap pack (normative)

Single source of truth for **`agentskeptic activate`** (canonical activation + exportable **`proof/`**) and the legacy **`agentskeptic bootstrap`** verb (same **`BootstrapPackInput` v1** kernel without proof export): flags, stdin/stdout/stderr, exit codes, pack layout, **`proof/`** subtree rules, **`activation.manifest.json`**, commercial verify-outcome beacon coupling, staging, and trust inheritance.

**Audience:** engineers implementing or testing the CLI; integrators obtaining a first contract pack without hand-authoring `tools.json` or production **`events.ndjson`**, plus operators who want machine-readable activation evidence beside the pack.

**Not in scope:** unstructured log ingestion. Bootstrap accepts only **`BootstrapPackInput` v1** (JSON). Arbitrary text logs remain out of scope per [verification-product.md](verification-product.md).

**Authority:** Quick inference thresholds and export bytes identity remain in [quick-verify-normative.md](quick-verify-normative.md). Batch verify semantics and `WorkflowResult` shape remain in [agentskeptic.md](agentskeptic.md); this document links to those sources and does not duplicate numeric ladders.

---

## CLI invocation

```text
agentskeptic activate --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>

agentskeptic bootstrap --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>
```

No other flags in v1 beyond the shared **`BootstrapPackCli`** grammar (`--help` / `-h` print usage and exit **`0`**).

**Recommended:** **`activate`** for onboarding and CI proofs. **`bootstrap`** remains a **legacy compatibility** verb—it is **not** an alias: same argv parser and **`executeBootstrapPack`** kernel, but **no** **`proof/`**, **no** **`activation.manifest.json`**, **no** **`AGENTSKEPTIC_ACTIVATION`** machine stderr lines (except untouched bootstrap error paths), **no** verify-outcome **`activation`** POST, and a different license-preflight reservation pattern (inner preflight only).

---

## Documentation authority matrix

| Topic | Authoritative location |
|-------|-------------------------|
| `activate` / `bootstrap` flags, I/O, exit codes, staging, success definition, **`proof/`** | **This file** |
| Disk manifest schema | `schemas/activation-manifest-v1.schema.json` |
| Verify-outcome beacon **`activation`** (HTTP) | `schemas/openapi-commercial-v1.yaml` → **`VerifyOutcomeRequestV2`** |
| `BootstrapPackInput` v1 JSON | This file **Contract appendix** + `schemas/bootstrap-pack-input-v1.schema.json` (schema must not contradict the appendix) |
| Optional hosted registry draft (website API, absolute schema `$ref` / AJV order, commercial harness) | [registry-draft.md](registry-draft.md) |
| Quick thresholds, `--export-registry` byte identity | [quick-verify-normative.md](quick-verify-normative.md) |
| `verify` stdout/stderr for `WorkflowResult` | [agentskeptic.md](agentskeptic.md) + shared `runStandardVerifyWorkflowCliFlow` behavior |
| Integrator onboarding checklist, integrate spine anchors, **`IntegrateSpineComplete`** prose | [first-run-integration.md](first-run-integration.md) |
| v2 integrator entry / Activation overview (hosted + npm framing) | [integrate.md](integrate.md) |
| Generated copy-paste shell commands (partner quickstart, Postgres, LangGraph oracle, **`verify-integrator-owned`**) | [partner-quickstart-commands.md](partner-quickstart-commands.md) — run **`node scripts/generate-partner-quickstart-commands.mjs`** |

### Integrator spine

The L0 **`scripts/templates/integrate-activation-shell.bash`** template runs **`activate`** mid-script for **PatternComplete** wiring and **`activate`** + **pack-led crossing** for **`wf_integrate_spine`**. Spine ordering, **`AGENTSKEPTIC_VERIFY_DB`**, adoption checklist IDs, and the pinned **`IntegrateSpineComplete`** contract live in **`first-run-integration.md`**; **`integrate.md`** remains the canonical integrator-facing summary that points here for **`activate`** / **`bootstrap`** detail.

---

## Trust inheritance

- **`quick-report.json`** is a full **`QuickVerifyReport`** (schema `quick-verify-report`). Quick Verify remains **provisional**; see `productTruth` in that JSON.
- **Exit `0`** additionally requires in-process contract **`verifyWorkflow`** to return **`status === "complete"`**. That is the only strengthened claim on success.

---

## Staging and `--out` directory

- **`--out`** must **not** exist before invocation (neither file nor directory). If it exists → exit **`3`**, code **`BOOTSTRAP_OUT_EXISTS`**.
- After validation, the implementation creates **`--out`** and writes pack files.
- **Contract terminal exits** (**`verifyWorkflow`** returned **`inconsistent`** / **`incomplete`** / **`complete`** after pack materialization): **`--out` is retained** so integrators can inspect the pack and (for **`activate`**) the **`proof/`** subtree. This supersedes any older “always delete `--out` on non-zero” behavior for those paths.
- **Early bootstrap CLI errors** (quick not pass, zero exportable tools, unreadable input, pack write failure before a stable contract certificate path, **etc.**): existing cleanup **may still remove **`--out`** best-effort (same semantics as legacy bootstrap).

---

## stdout / stderr (summary)

| Exit | Verb | stdout | stderr (high level) |
|------|------|--------|-----------------------|
| `0` (`pack_ready`) | **`activate`** | **`agentskeptic_activate_result`** envelope | Three **`AGENTSKEPTIC_ACTIVATION …`** machine lines (**no** trailing human stderr on this path today) |
| `0` (`pack_ready`) | **`bootstrap`** | **`agentskeptic_bootstrap_result`** envelope | Empty |
| `1`–`2` (`verify_terminal`) | **`activate`** | Outcome Certificate v1 (**same stdout** semantics as **`verify`**) | Machine **`AGENTSKEPTIC_ACTIVATION`** block first, **`proof/`** subtree present, **then** the normal human truth report + footer |
| `1`–`2` (`verify_terminal`) | **`bootstrap`** | Outcome Certificate v1 (**same stdout** semantics as **`verify`**) | Human truth report + footer **only** (no proof subtree) |
| `2b` / `3` (bootstrap CLI operational) | **`activate`** | Empty (or operational envelope policy per code) | For quick-path blocks: **`AGENTSKEPTIC_ACTIVATION stage=provisional_infer trust_terminal=blocked`** + JSON **`cliErrorEnvelope`** when applicable |
| `2b` / `3` (bootstrap CLI operational) | **`bootstrap`** | per legacy table | **`cliErrorEnvelope`** |

Implementation ties **`verify_terminal`** contract stdout/stderr to the existing **`emitVerifyWorkflowCliJsonAndExitByStatus`** path so certificate bytes cannot drift from **`verify`**. **`activate`** inserts deterministic machine stderr + filesystem **`proof/`** **before** that human/certificate sequence on terminal contract exits.

---

## Commercial / OSS

- **`bootstrap`:** **`runLicensePreflightIfNeeded("verify")`** runs **inside** **`executeBootstrapPack`** (same entitlement dimension as **`quick`**).
- **`activate`:** outer **`runLicensePreflightIfNeeded("verify")`** reserves the run id, then **`executeBootstrapPack(..., { preflight: "caller_reserved" })`** skips the inner duplicate.
- **Verify-outcome beacon:** commercial builds POST **`/api/v1/funnel/verify-outcome`** with **`subcommand: "activate"`** and **required** nested **`activation`** on **`activate`** terminal rows **1–3** (see OpenAPI). OSS builds skip the POST but still write **`activation.manifest.json`** on disk when **`activate`** reaches a contract terminal state.

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
