# CI / Cursor workflow validation (operator checklist)

**Normative operator docs** remain in **[`CONTRIBUTING.md`](../CONTRIBUTING.md)** (GitHub Actions). This file is a **checklist** for the unified **`ci.yml`**: one run per push/PR, no path filters, production and release behavior as described there.

## GitHub / Vercel settings not in the repo (must be done in the UI or API)

- **Ruleset / branch protection** on `main`: required status checks (see `CONTRIBUTING.md` table) — you must add **`CI / Python`** if you are upgrading from the pre-unification five-check setup.
- **Repository variables:** `COMMERCIAL_LICENSE_API_BASE_URL`, `RELEASE_APP_ID` (and any others you use for release).
- **Repository secrets:** `RELEASE_APP_PRIVATE_KEY`, Vercel **`VERCEL_TOKEN`**, **`VERCEL_ORG_ID`**, **`VERCEL_PROJECT_ID`**.
- **Vercel project:** root directory, install command, and that **`git.deploymentEnabled.main`** remains **false** (or equivalent) so production is not double-driven by Git; production should follow **GHA** `vercel deploy` only.
- **GitHub App** used for release: permissions to push to `main`, create releases, and compatibility with your ruleset.

## `gh` commands (from a clone with `gh auth login`)

- **List checks on a PR:**  
  `gh pr checks <PR_NUMBER> --json name,state`  
  Expect **six** PR checks: `CI / Conventional Commits`, `CI / CodeQL (javascript-typescript)`, `CI / test`, `CI / commercial`, `CI / Python`, `CI / Release preview`.

- **Watch a PR run:**  
  `gh pr view <PR_NUMBER> --web` (optional) or `gh run list --workflow=CI` then `gh run watch <RUN_ID>`

- **After squash merge to `main`, watch the `main` `CI` run and deploy:**  
  `gh run list --branch=main --workflow=CI`  
  `gh run view <RUN_ID> --log-failed` (if failed)

- **Release workflow (after green `CI` on a `main` push):**  
  `gh run list --workflow=Release`

## Scenario expectations (a–g)

| ID | Scenario | What should happen |
|----|----------|-------------------|
| a | **Website-only PR** (e.g. only `website/**`) | **Full `CI` runs** (not skipped). Same six PR checks. No “missing” required checks. |
| b | **Docs-only PR** (e.g. only `docs/**` or `*.md` outside enforcement) | **Full `CI` runs** (no path filter). Slightly more work (CodeQL, etc.) for doc edits — intentional for one predictable gate. |
| c | **Package / root change PR** | **Full `CI`**, including `commercial` and `test`. |
| d | **Mixed `website` + package PR** | **Single** `CI` run; **one** Vercel production path on `main` after success — still only **`ci.yml` → `vercel_production`**. |
| e | **Python-only PR** | **`CI / Python`** is required; no separate `python-verify` workflow. |
| f | **Squash merge to `main` with a message that should release** (e.g. `fix: …` / `feat: …` per your rules) | **`CI` succeeds** on the squash commit → **`Release`** runs via `workflow_run` → semantic-release may version, tag, and publish. |
| g | **Squash merge to `main` that should deploy the site but not cut a new npm/PyPI version** (e.g. `chore:` / `docs:` with no releasable analyzer outcome) | **`CI` succeeds** on `main` → **`Vercel production`** job runs; **`Release`** may **skip** (no new version) if there is nothing releasable. |

**Duplicate production deploys:** with **`website.yml` removed**, there is a **single** production deploy path: **`CI` / `Vercel production` on `main` push** after `codeql`, `test`, `commercial`, and `python` succeed.

## Local contract test (optional)

- `node --test test/github-workflows-agentskeptic-telemetry-env.test.mjs` — keeps workflow job inventories and `AGENTSKEPTIC_TELEMETRY` env aligned with the YAML.
