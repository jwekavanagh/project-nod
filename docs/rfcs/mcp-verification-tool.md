# RFC: MCP verification tool

**Status:** decision record (Phase 10). **Scope:** decide whether AgentSkeptic should ship a minimal Model Context Protocol (MCP) verification surface. **Non-goals:** implementing MCP, adding packages or servers, changing CLI/SDK/Action/Cursor/OpenAPI/telemetry/enforcement semantics.

**Related SSOTs:** [`docs/first-truth-check.md`](../first-truth-check.md), [`docs/integrate.md`](../integrate.md), [`docs/cursor-integration.md`](../cursor-integration.md), [`docs/ambient-ci-distribution.md`](../ambient-ci-distribution.md), [`docs/commercial.md`](../commercial.md), [`docs/shareable-verification-reports.md`](../shareable-verification-reports.md), [`docs/activation-telemetry-review.md`](../activation-telemetry-review.md).

## Decision

**Recommended: defer MCP.**

AgentSkeptic does **not** expose an MCP verification tool today. This RFC does **not** imply MCP exists or is supported.

## Context

Phases 1–9 converged the default first-run path on **`agentskeptic check`** (CLI), **`AgentSkeptic.check`** (TypeScript SDK), a thin GitHub Actions composite ([`.github/actions/agentskeptic-check/action.yml`](../../.github/actions/agentskeptic-check/action.yml)), and a Cursor rule ([`examples/cursor/agentskeptic-check.mdc`](../../examples/cursor/agentskeptic-check.mdc)). Phase 9 activation telemetry work explicitly treated MCP as out of scope ([`docs/activation-telemetry-review.md`](../activation-telemetry-review.md)).

Separately, operator docs mention **Supabase MCP** for running KPI SQL ([`docs/growth-metrics.md`](../growth-metrics.md)). That is **operator tooling**, not a product MCP server for verification. This RFC concerns only a hypothetical **AgentSkeptic MCP tool** for integrators/agents.

## Problem

Should AgentSkeptic expose a minimal MCP verification tool, or is the CLI / GitHub Action / Cursor rule / SDK path sufficient for now?

The goal is a **precise, bounded decision**, not roadmap enthusiasm.

## Non-goals

- Implementing MCP, MCP SDK dependencies, or an MCP server package in this repository.
- Adding CLI modes (`agentskeptic mcp`), protocol handlers, hosted `/api/verify`, or new framework examples.
- Changing **`agentskeptic check`**, **`AgentSkeptic.check`**, **`agentskeptic enforce`**, **`agentskeptic loop`**, Outcome Certificate schema, or telemetry behavior.
- Rewriting onboarding docs or listing MCP as the default first-run path.
- Marketing MCP as an available product surface before implementation.

## User workflows considered

### Workflow A: Local coding agent verifies after edits

An agent in Cursor / Claude Desktop / another MCP host runs a truth check after editing workflow or tool code.

**Assessment:** The Cursor rule already instructs agents to run **`npx agentskeptic check`** with the same stdout/stderr contract ([`examples/cursor/agentskeptic-check.mdc`](../../examples/cursor/agentskeptic-check.mdc)). MCP does **not** materially improve reliability versus “run the CLI + read stderr verdict line + stdout Outcome Certificate,” unless the host **cannot** spawn shell commands reliably.

### Workflow B: Agent asks for structured verification result

An agent wants a structured tool result instead of parsing stdout/stderr.

**Assessment:** **`agentskeptic check`** already emits machine JSON on stdout — the **Outcome Certificate**. stderr begins with **`truth_check_verdict: trusted|not_trusted|unknown`** ([`docs/first-truth-check.md`](../first-truth-check.md)). **`AgentSkeptic.check`** returns the same structured certificate in-process ([`docs/integrate.md`](../integrate.md)). MCP JSON wrapping adds surface area without fixing a parsing gap that is clearly dominant today.

### Workflow C: Hosted / report sharing

An agent wants to publish or retrieve a shareable report via MCP.

**Assessment:** Shareable reports are already documented as an **optional** CLI path (`--share-report-origin`) with explicit privacy caveats ([`docs/shareable-verification-reports.md`](../shareable-verification-reports.md)). Pulling this into MCP MVP would mix **network egress**, **hosted POST semantics**, and **secret-bearing payloads** with “run a local check.” **Defer** share/report from any MCP MVP unless there is isolated demand and a dedicated security review.

### Workflow D: Stateful commercial enforcement

An agent wants to run **`agentskeptic enforce`**.

**Assessment:** **`enforce`** is opt-in, commercial, stateful, and may require **`AGENTSKEPTIC_API_KEY`** and license API reachability ([`docs/commercial.md`](../commercial.md)). Exposing **`enforce`** via MCP in MVP would broaden the attack and support surface without proving demand. **Exclude from MVP.**

## Current alternatives

These surfaces already cover many integration needs. MCP must not be framed as the default first-run path.

| Surface | Role | First-run default? |
|--------|------|---------------------|
| **CLI:** `npx agentskeptic check` | Stateless truth check; stdout = Outcome Certificate; stderr = `truth_check_verdict` + human report | **Yes** |
| **SDK:** `AgentSkeptic.check` | Same contract in-process for TypeScript apps | **Yes** (for programmatic embeds) |
| **GitHub Action:** `.github/actions/agentskeptic-check` | Thin CI wrapper; default **`mode: check`**; captures stdout/stderr | **Yes** (for CI) |
| **Cursor rule:** `examples/cursor/agentskeptic-check.mdc` | Prompts agents to run **`agentskeptic check`** locally | Optional local loop |
| **OpenAPI:** `schemas/openapi-commercial-v1.yaml` | Commercial license, reporting, enforcement HTTP APIs; **`externalDocs`** points to runtime truth-check guide ([`docs/first-truth-check.md`](../first-truth-check.md)) | N/A (API contract, not runtime verify) |
| **CI enforcement:** `agentskeptic enforce` | Baseline/drift/acceptance; stateful; commercial/opt-in | **No** — later |

## Recommendation

**Defer MCP.** There is no strong, measured reason today that MCP improves real workflows beyond the CLI, Action, Cursor rule, and SDK — especially because stdout is already structured (**Outcome Certificate**) and stderr exposes **`truth_check_verdict`**.

Deferral is **not** permanent rejection. Revisit when evidence appears (see below).

## MVP scope, if approved later

If MCP is approved in a future phase, scope should be **narrow**:

- **Exactly one** tool: **`agentskeptic_check`**.
- **Wrap only** **`agentskeptic check`** (stateless OSS path). **No** **`enforce`**, **no** `--share-report-origin`**, **no** hosted verification API.
- **Local by default:** reads user-supplied paths under a bounded working directory; **no** requirement for hosted AgentSkeptic APIs for MVP.

## Tool contract

Draft only — **not implemented**.

### Tool input schema

```json
{
  "workflowId": "wf_complete",
  "eventsPath": "examples/events.ndjson",
  "registryPath": "examples/tools.json",
  "dbPath": "examples/demo.db",
  "extraArgs": []
}
```

Optional fields (future):

```json
{
  "workingDirectory": ".",
  "timeoutMs": 120000,
  "shareReportOrigin": null
}
```

**`extraArgs`:** Dangerous — arbitrary strings become CLI arguments and can enable **command injection** if concatenated into a shell without careful escaping. If ever supported: **default off**, explicit env flag to enable, **allowlist** of known-safe flags only, **no** raw shell interpolation.

### Tool output schema

```json
{
  "truthCheckVerdict": "trusted",
  "exitCode": 0,
  "stdoutPath": "/tmp/agentskeptic.stdout",
  "stderrPath": "/tmp/agentskeptic.stderr",
  "certificate": {},
  "summary": "..."
}
```

**Conservative default:** include parsed **`truthCheckVerdict`** (from stderr line), **`exitCode`**, paths to captured stdout/stderr (full streams on disk for agent follow-up). Optionally include **parsed Outcome Certificate** inline only if size-capped (e.g. ≤ 256 KiB parsed JSON) and validated against the existing certificate schema; otherwise return **`certificate: null`** and rely on **`stdoutPath`**. Do **not** embed large human reports by default.

## Security and privacy

- **Local file access:** Tool arguments name paths; server must **resolve within `workingDirectory`**, reject **`..`** traversal, and refuse unreadable paths early (`missing_file`).
- **Secrets:** Events/registry may contain parameters; DB URLs may embed credentials; Outcome Certificate and stderr human report may contain sensitive lines — treat captured files as **confidential user data**. Never ship contents to telemetry (existing CLI telemetry boundary: [`docs/activation-telemetry-review.md`](../activation-telemetry-review.md)).
- **Shell / injection:** Prefer **`spawn`** with argument array (no shell) when shelling out; never concatenate untrusted strings into one shell line; **`extraArgs`** requires strict policy if ever enabled.
- **Timeouts and size limits:** Enforce **`timeoutMs`**; cap captured stdout/stderr bytes with clear truncation markers to avoid OOM or MCP payload blowups.
- **Network:** MVP **must not** introduce new network calls. Shell-out to **`agentskeptic check`** reuses existing CLI behavior only (including optional opt-in telemetry **`POST`** when consent allows — unchanged). **`AGENTSKEPTIC_TELEMETRY=0`** continues to force telemetry off.
- **Hosted sharing:** **`shareReportOrigin`** is **out of MVP**; it implies HTTPS **`POST`** of certificate-shaped data ([`docs/shareable-verification-reports.md`](../shareable-verification-reports.md)).

## Auth and execution model

- **MVP:** **No API key.** Stateless **`check`** only.
- **`enforce`:** Out of MVP — requires **`AGENTSKEPTIC_API_KEY`** and commercial licensing story ([`docs/commercial.md`](../commercial.md)).

### Execution model comparison

| Approach | Pros | Cons |
|----------|------|------|
| **A. Shell out to `agentskeptic check`** | Single contract with CLI; preserves exit codes and stderr contract; simplest to test | Subprocess overhead; must secure argv and cwd |
| **B. Call internal JS/TS check kernel** | No subprocess; potentially faster | Risks **drifting from CLI** behavior and flags; tighter coupling |

**Bias for future MVP:** **A — shell out**, to preserve one verified integration surface.

## Error handling

Canonical categories for a future MCP tool (mapping is illustrative):

| Category | Meaning | MCP tool result |
|----------|---------|-----------------|
| `invalid_input` | Schema / path validation failed before CLI | Structured error; no CLI run |
| `missing_file` | Events/registry/db path not found | Same |
| `cli_not_found` | `agentskeptic` binary not on PATH | Same |
| `check_failed` | CLI exited non-zero for contract failure | Preserve **`exitCode`**; expose stdout/stderr paths |
| `verdict_not_trusted` | **`truth_check_verdict: not_trusted`** | **Not** the same as operational failure — deterministic mismatch |
| `verdict_unknown` | **`truth_check_verdict: unknown`** | Incomplete evidence — **not verified** |
| `timeout` | Subprocess exceeded **`timeoutMs`** | Kill child; surface partial captures if safe |
| `operational_error` | CLI exit **3** / envelope errors per CLI docs | Preserve contract |
| `parse_error` | Could not parse Outcome Certificate JSON from stdout | Surface raw **`stdoutPath`**; verdict may still be readable from stderr |

**Important:** **`not_trusted`** is a valid verification outcome, not necessarily “tool broken.” **`unknown`** means **not verified**. Never hide stdout/stderr paths when the CLI ran.

## Telemetry boundary

Future MCP implementation must **not** add new telemetry fields or bypass **`AGENTSKEPTIC_TELEMETRY=0`**. Shell-out inherits existing CLI behavior documented in [`docs/activation-telemetry-review.md`](../activation-telemetry-review.md).

## Documentation and discovery impact

**Phase 10:** **No** change to [`docs/first-truth-check.md`](../first-truth-check.md), Cursor docs, discovery payload, or **`llms.txt`**.

**If MCP is implemented later:** Add an **optional advanced** link from [`docs/first-truth-check.md`](../first-truth-check.md) (e.g. under “Use it with Cursor or coding agents”) — MCP remains **secondary** to **`agentskeptic check`**. Update [`docs/cursor-integration.md`](../cursor-integration.md) only if Cursor MCP registration steps are accurate. Regenerate discovery **after** implementation if required by repo convention. Extend [`test/integration-story-drift.test.mjs`](../../test/integration-story-drift.test.mjs) only to **whitelist internal RFC paths** if needed — **without** weakening the invariant that **`agentskeptic check`** is the default first-run path.

## Test plan for future implementation

- Contract tests for input JSON schema validation and path canonicalization.
- Golden subprocess tests: stdout parses as Outcome Certificate when expected; stderr **`truth_check_verdict`** line extracted.
- Timeout and max-output-size behavior.
- Security tests: traversal attempts rejected; **`extraArgs`** blocked unless allowlist enabled.
- Regression: **`AGENTSKEPTIC_TELEMETRY=0`** still disables telemetry when invoking via MCP wrapper.

## Acceptance criteria for future implementation

- Single tool **`agentskeptic_check`**, local-only, stateless, shells out to **`agentskeptic check`**.
- No **`enforce`**, no **`--share-report-origin`** in MVP.
- Preserves CLI exit codes; never hides stdout/stderr artifacts.
- Telemetry boundary unchanged; documented operator differences none.
- Drift gate still passes; MCP not promoted above CLI in adoption docs.

## Open questions

- Packaging: separate **`@agentskeptic/mcp`** vs. optional dependency vs. documented standalone server repo?
- Which MCP hosts (Cursor, Claude Desktop, VS Code) justify maintenance cost first?
- Whether **`extraArgs`** should exist at all in v1 or remain forbidden forever.

## Reasons to defer or reject

- **Activation proof first:** Phase 9 telemetry does not yet prove agents fail without MCP ([`docs/activation-telemetry-review.md`](../activation-telemetry-review.md)).
- **Structured output already exists:** Outcome Certificate on stdout; **`truth_check_verdict`** on stderr.
- **Surface-area cost:** MCP adds release, security review, and support burden before demand is proven.

### Evidence that would justify revisiting MCP

- Repeated user evidence that agents **cannot** reliably run or parse CLI checks in specific hosts.
- Telemetry showing users reach first **`agentskeptic check`** but fail to integrate **local agent loops** (today’s schema gaps around surface discriminators are documented in Phase 9 — closing those may be prerequisite).
- Customer request for MCP in a **specific IDE/agent environment**.
- Enough adoption and staffing to justify **another** integration surface and security lifecycle.

### Fallback guidance (until MCP exists)

For now, use **`agentskeptic check`** directly, the **GitHub Action** for CI, and the **Cursor rule** for local agent coding loops. Revisit MCP when there is evidence that agents need structured tool output **beyond** what the CLI and wrappers already provide — not merely JSON wrapping of the same streams.

---

**Explicit statements**

1. **MCP is not implemented** in AgentSkeptic as of this RFC.
2. **MCP is not** the default first-run integration path; **`agentskeptic check`** remains canonical ([`docs/first-truth-check.md`](../first-truth-check.md)).
