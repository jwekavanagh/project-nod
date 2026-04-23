# Verification operational notes (runbooks)

**Audience:** engineers wiring a first run, integrators automating stdout/stderr, operators hardening database access. Product intent and trust boundary remain in [`verification-product.md`](verification-product.md); CLI semantics in [`agentskeptic.md`](agentskeptic.md) and [`quick-verify-normative.md`](quick-verify-normative.md).

## For engineers (first run)

1. **Clone** the repository and **`npm install`**.
2. **`npm run build`** (or **`npm test`**, which builds first).
3. **`npm run build && node scripts/first-run.mjs`** — creates **`examples/demo.db`** and runs the narrated onboarding smoke (see [`agentskeptic.md`](agentskeptic.md) onboarding; also runs as part of **`npm test`**).
4. **Quick verify:**  
   `node dist/cli.js quick --input test/fixtures/quick-verify/pass-line.ndjson --db examples/demo.db --export-registry ./quick-export.json`  
   Supply structured tool activity on **stdin** with **`--input -`** when convenient. Optional **`--emit-events`** writes synthetic **`tool_observed`** NDJSON for **every exported tool** (see [`quick-verify-normative.md`](quick-verify-normative.md) § A.3b). Eligible inferred **`related_exists`** units are exported when **`eligible_export_related_exists`** holds (see [`quick-verify-normative.md`](quick-verify-normative.md) § A.3b); otherwise they stay quick-only with `contractEligible: false`.

## For integrators

- **Machine contract:** one **stdout** JSON line (`QuickVerifyReport`, **`schemaVersion` 4**), **exit code** 0/1/2/3, and on operational failure a **single-line JSON envelope** on stderr.
- **Do not** parse human stderr for automation. stderr begins with three **fixed** anchor lines (see [`quick-verify-normative.md`](quick-verify-normative.md) § A.3a); remaining lines are user-facing only.
- **Contract replay** (repeatable batch path, **partial** vs quick scope): after quick, run  
  `agentskeptic --workflow-id <id> --events <emit-path> --registry <export-path> --db <sqlitePath>`  
  (or **`--postgres-url`**) with the same DB snapshot. Exported tools in the registry file align with synthetic events by `toolId` and `seq` (see [`quick-verify-normative.md`](quick-verify-normative.md) § A.3b). Treat this as **exported-tool replay**, not “everything quick inferred is now contract-checked.”

## For operators

- Verification uses **read-only** SQLite opens and Postgres session guards (see [`agentskeptic.md`](agentskeptic.md)). Use a **least-privilege** DB user in production.
- **No** writes are performed against the target database for verification.

## Time to first meaningful result (Story 5)

`validate-ttfv` (see [`scripts/validate-ttfv.mjs`](../scripts/validate-ttfv.mjs) and [`scripts/lib/quickVerifyPostbuildGate.mjs`](../scripts/lib/quickVerifyPostbuildGate.mjs)) runs **after** a successful **`npm run build`**. It enforces a **spawn timeout** and post-run wall clock (**120s**), parses the **stdout** **`QuickVerifyReport`** line (**`schemaVersion` 4**), and checks that the **exported registry file** matches **`canonicalToolsArrayUtf8`** of the report’s tools. `npm install` duration is network-bound and excluded. A run that completes within three minutes on CI hardware is sufficient evidence that a typical user can reach a first meaningful result within thirty minutes including reading the README and supplying structured tool activity (file or stdin).

## Quick export vs contract replay coverage

Quick verify exports **`sql_row`** registry entries for high-confidence row mappings. Inferred **`related_exists`** units are exported as Advanced **`sql_relational`** registry entries (single const-only **`related_exists`** check) when **`eligible_export_related_exists`** is satisfied; see [`quick-verify-normative.md`](quick-verify-normative.md) § A.3b. Non-eligible **`related_exists`** units stay quick-only (`contractEligible: false`) until you extend the registry by hand. This is a **coverage boundary**, not a promise of end-to-end parity between quick and contract runs.
