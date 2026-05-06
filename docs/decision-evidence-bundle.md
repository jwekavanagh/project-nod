# Decision evidence bundle (operational SSOT)

Normative definitions of **ProductionComplete**, artifacts **A1–A5**, and adoption checks remain in [`adoption-epistemics.md`](adoption-epistemics.md). This document defines how **operational retention** maps to portable JSON files for reviewers and CI.

## Evidence maturity (three steps)

Use the lightest mode that fits the job; add retained files only when you need governance, customer review, or audit handoff.

| Step | What you run | What you keep |
|------|----------------|----------------|
| **1 — Default truth check** | `agentskeptic check` (or SDK equivalent) with no bundle flags | **stdout:** Outcome Certificate JSON. **stderr:** human report and `truth_check_verdict:` line. Nothing is written to disk unless you redirect. |
| **2 — Decision evidence on disk** | Add **`--write-decision-bundle <dir>`** (alias **`--proof <dir>`**) | **Decision evidence bundle** directory: certificate, `exit.json`, `human-layer.json`, `manifest.json`, optional A4/A5 (see [Directory layout](#directory-layout)). |
| **3 — Full local proof (technical + decision)** | Add **`--write-run-bundle <other-dir>`** alongside `--write-decision-bundle` | **Technical run bundle** in the run directory (events, `workflow-result.json`, `agent-run.json`, optional signing) **and** the decision bundle in the decision directory. The CLI writes both when both flags are set (see [Technical run bundle](#terminology)). |

**Authoritative full audit package (on-disk files):** The complete set of decision-grade files (`outcome-certificate.json`, `exit.json`, `human-layer.json`, manifest, optional `attestation.json` / `next-action.json`) plus the optional **technical run bundle** is produced **only** from the **CLI** (step 2 or 3). Hosted commercial APIs do **not** emit that directory layout.

## Terminology

| Name | Purpose |
|------|---------|
| **Technical run bundle** | `--write-run-bundle`: `events.ndjson`, `workflow-result.json`, `agent-run.json` (optional signing). For reproduction and engine debugging. |
| **Decision evidence bundle** | `--write-decision-bundle`: outcome certificate, exit record, human-layer, manifest, optional attestation / next-action. For audit and decision retention without shell redirection. |

## Directory layout

Written only when **`--write-decision-bundle <dir>`** is passed (opt-in).

| File | Role |
|------|------|
| `outcome-certificate.json` | A1 — [`OutcomeCertificateV3`](../schemas/outcome-certificate-v3.schema.json) |
| `exit.json` | A2 — exit code mapped from the certificate; `cliConvention` **`outcome_certificate_v2`** ([`decision-evidence-exit-v1`](../schemas/decision-evidence-exit-v1.schema.json)) |
| `human-layer.json` | A3 — human report text or `suppressed` when `--no-human-report` |
| `attestation.json` | Optional A4 — [`decision-evidence-attestation-v1`](../schemas/decision-evidence-attestation-v1.schema.json) via `--decision-attestation` |
| `next-action.json` | Optional A5 — [`decision-evidence-next-action-v1`](../schemas/decision-evidence-next-action-v1.schema.json) via `--decision-next-action` |
| `manifest.json` | Bundle metadata + **completeness** (explicit `a4Present`, `a5Present`, `a5Required`) |

## Completeness rules

- **`stateRelation`** on the outcome certificate is authoritative (see [`outcome-certificate-normative.md`](outcome-certificate-normative.md)).
- **`a5Required`** is **true** iff `stateRelation` is `does_not_match` or `not_established`; then **`next-action.json`** is required for **`manifest.completeness.status === "complete"`**. Otherwise the bundle may be **partial**.
- **A4** does not gate mechanical **`complete`**; **`a4Present`** is explicit for reviewers. Adoption-level ProductionComplete may still require human attestation per [`adoption-epistemics.md`](adoption-epistemics.md).

## CLI

Batch verify, **verify-integrator-owned**, and **quick** share the same optional flags:

- `--write-decision-bundle <dir>` (or `--proof <dir>`)
- `--write-run-bundle <dir>` (second directory for technical run bundle; use with step 3 above)
- `--decision-attestation <path>`
- `--decision-next-action <path>`

### Validation

```bash
agentskeptic decision-bundle validate <dir>
```

- **Stdout:** exactly **one** JSON line (`kind: decision_bundle_validation`, `schemaVersion: 1`), sorted keys.
- **Exit:** `0` complete, `1` partial, `2` invalid, `3` operational failure.

## Hosted governance export (**GovernanceAuditBundleV3**)

`GET /api/v1/governance/export` returns JSON **`GovernanceAuditBundleV3`** (**breaking:** **`schemaVersion: 3` only**) with governance timeline rows plus **`evidenceSlices`** — one slice per **`governance_evidence`** row keyed by immutable evidence id (**not** CLI technical bundle semantics). Each slice includes **`outcomeCertificate`**, **`fingerprints`** (must match **`agentskeptic/governanceEvidence`** recomputation), **`hostedExit`** (strict **`decision-evidence-exit-v1`**, **`cliConvention: outcome_certificate_v2`** retained for compatibility with the standalone exit schema label), **`decisionCompleteness`**, and **`truthCheckVerdict`**.

| Aspect | Hosted export (**GovernanceAuditBundleV3**) | CLI decision bundle |
|--------|----------------|----------------------|
| On-disk layout (`outcome-certificate.json`, `exit.json`, …) | **Not produced** | **Yes** when `--write-decision-bundle` is set |
| Certificate + exit linkage | Stored per evidence row (`evidenceSlices[id]`) | Files on disk |
| A4 / A5 files | **Not** embedded as standalone artifacts | Optional files per table above (`attestation.json`, `next-action.json`) |
| Technical run NDJSON (**`--write-run-bundle`**) | **Hosted never emits** — CLI-only forensic depth | **Yes** alongside decision bundle when both flags |

For ingestion invariants (**Outcome Certificate v3** only, fingerprints SSOT) and export corruption semantics (**500 CORRUPTED_EVIDENCE_ROW**), see [`governance.md`](governance.md) and **`schemas/outcome-certificate-v3.schema.json`**.

## Audit handoff (packaging recipe)

There is no separate “archive” subcommand. For external review, package the directories your CI or local run produced.

**Example (two directories after step 3):** `proof/decision/` (decision bundle) and `proof/run/` (technical run bundle):

```bash
# Unix-like: single archive for handoff
zip -r agentskeptic-proof.zip proof/decision proof/run
# or
tar -cvzf agentskeptic-proof.tar.gz proof/decision proof/run
```

```powershell
# Windows PowerShell: zip both folders
Compress-Archive -Path proof\decision, proof\run -DestinationPath agentskeptic-proof.zip
```

Validate the decision folder when policy requires mechanical completeness:

```bash
agentskeptic decision-bundle validate proof/decision
```

Retain **stdout/stderr** from the same job if your process expects the Outcome Certificate line-exact on stdout.
