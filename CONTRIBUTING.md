# Contributing

Thanks for helping improve **agentskeptic**.

## Before you start

- Read **[README.md](README.md)** for the product model and quickest demo (`npm start`).
- Normative behavior and CLI contracts live in **[docs/agentskeptic.md](docs/agentskeptic.md)**; product and correctness boundaries in **[docs/verification-product.md](docs/verification-product.md)** and **[docs/correctness-definition-normative.md](docs/correctness-definition-normative.md)**.

## Development setup

- **Node.js ≥ 22.13** (see `package.json` `engines`).
- `npm install`
- `npm run build` — TypeScript compile and asset copy.
- `npm test` — default validation before a PR (OSS `npm run build` + Vitest + SQLite `node:test`, then `scripts/commercial-enforce-test-harness.mjs` rebuilds **commercial** `dist/` and runs **`enforce`** integration tests plus **`assurance` CLI regression tests`, then `npm run build` restores OSS `dist/`, then `npm run validate-ttfv`). Policy: **[`docs/commercial-enforce-gate-normative.md`](docs/commercial-enforce-gate-normative.md)**.

### Postgres / website integration tests (`DATABASE_URL`, `TELEMETRY_DATABASE_URL`)

**Normative:** Copy [`website/.env.example`](website/.env.example) to **`website/.env`** and set valid **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`** (local Postgres on the same port with separate DB names is fine—see the example). Run migrations as documented for the website package before expecting commercial or telemetry tests to pass.

**Do not treat skipped tests as OK:** Many website integration suites use **`describe.skipIf(!DATABASE_URL || !TELEMETRY_DATABASE_URL)`**. If those variables are unset, tests **skip**—that is a **configuration failure**, not a green run.

**Single command that loads `website/.env` and mirrors CI:** **`npm run validate-commercial`** (see [`scripts/validate-commercial-funnel.mjs`](scripts/validate-commercial-funnel.mjs)). Use this before a PR whenever you touch commercial, telemetry, funnel, or website DB-backed behavior.

**One instance per checkout:** Do not run two **`validate-commercial`** processes against the same clone at once—the script acquires **`artifacts/validate-commercial.lock`** (PID-based). Overlap previously caused Next.js “Another next build process is already running.” If you see **`validate_commercial_lock_busy`**, wait for the other run or remove a stale lock only after confirming no PID is still active.

**Avoid:** Running **`npx vitest`** from `website/` for those suites without having exported the URLs in your shell (Vitest does not load `website/.env` by itself the way `validate-commercial` does). There is **no** required repo-root `.env`; the project convention is **`website/.env`**.

## Pull requests

- **Public URLs, one-liner, and acquisition copy:** edit **[`config/marketing.json`](config/marketing.json)** only; run **`node scripts/validate-marketing.cjs`** (also executed by **`npm run check:primary-marketing`**). From **repo root** run **`npm run emit-primary-marketing`** (or **`npm run sync:public-product-anchors`**, the alias) and commit the derived artifacts: `schemas/openapi-commercial-v1.yaml`, root `package.json` fields, `llms.txt`, `src/publicDistribution.generated.ts`, and README marker regions. This matches [`docs/public-distribution.md`](docs/public-distribution.md). If you touch distribution surfaces, run **`npm run validate-commercial`** (requires Postgres **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`** in `website/.env`) before opening a PR. If you change **`prepublishOnly`**, **`scripts/pack-smoke-commercial.mjs`**, or commercial codegen, also run **`npm run pack-smoke`** (or rely on **`validate-commercial`**, which includes it). Do not edit prose inside README sync markers by hand.
- Keep changes focused; match existing style and patterns in touched files.
- If you change user-visible CLI behavior, stdout/stderr, or schemas, update the relevant **docs** and **tests** (many behaviors are guarded by doc-contract and golden tests).
- Do not duplicate normative numbers or stream contracts in the README when they belong in `docs/quick-verify-normative.md` or `docs/agentskeptic.md`.

## Dependency security (merge gate vs policy)

**Machine-readable pins and checks** live in [`docs/dependency-security-pins.json`](docs/dependency-security-pins.json); the JSON shape is defined by [`docs/dependency-security-pins.schema.json`](docs/dependency-security-pins.schema.json). CI runs `scripts/assert-dependency-security-pins.mjs` and contract tests that read that manifest—do not describe alternate numeric floors in prose here; change the manifest and matching `package.json` / lockfiles in the same change.

**Merge-gated (proven in CI):** Under `website/src/`, the repository forbids any source text that matches an entry in the manifest’s **`drizzleMachineChecks`** list (each entry is a regular expression plus flags). That list is the **only** Drizzle-related static surface area this repo treats as automatically enforced in CI for this workstream.

**Policy-only (human review):** Any stricter Drizzle or SQL style rules that are **not** listed in **`drizzleMachineChecks`** are documentation and review policy only; they are **not** merge-gated by those checks until someone extends the manifest and tests accordingly.

### Marketing copy and marketing.json sync

- **Marketing SSOT:** edit **`config/marketing.json`** (**`node scripts/validate-marketing.cjs`**; **`npm run check:primary-marketing`** or **`check:discovery-acquisition`** runs discovery + marketing validation).
- **Site-only copy:** edit **`website/src/content/productCopy.ts`** for non-JSON UI strings (account, integrate shell, a11y, short labels). **Public commercial and pricing text** lives in **`website/src/lib/commercialNarrative.ts`** with numerics in **`config/commercial-plans.json`** (not duplicated in `productCopy`).
- **Site IA (nav, Learn hub, sitemap, redirect):** canonical rules live in **`docs/website-product-experience.md`** and must stay consistent with **`website/src/lib/siteChrome.ts`** and **`website/src/app/sitemap.ts`**. The **`/guides`** Learn hub is **indexable** and listed in the sitemap; **`GET /examples`** (hub path only) **308** redirects to **`/guides`**.
- **Sync:** after changing marketing JSON, run **`npm run emit-primary-marketing`** (or **`sync:public-product-anchors`**) from repo root and commit the regenerated artifacts listed in [`docs/public-distribution.md`](docs/public-distribution.md).
- **Gate:** before merging marketing changes, run **`npm run verify:web-marketing-copy`** so validation, visitor-outcome node tests, the website build, **`marketing-*.contract` tests**, and the full website Vitest suite (including **`docs-marketing-contract`**) all pass.

## Conventional Commits (merge gate)

Releases and changelogs are **fully automated** from [Conventional Commits](https://www.conventionalcommits.org/) on `main` via [`semantic-release`](https://github.com/semantic-release/semantic-release) (see the Release workflow below). To keep `main` releasable:

- **`feat:`** → a **minor** release; **`fix:`** or **`perf:`** → **patch**; **`BREAKING CHANGE:`** in the commit body, or a **`!`** after the type/scope (e.g. `feat(api)!: …`) → **major**.
- Other types (`chore:`, `docs:`, `ci:`, `refactor:`, `test:`, `build:`, …) do **not** trigger a new npm/PyPI version by themselves unless they include a breaking marker.
- **Local hook:** with `npm install`, [**Husky**](https://typicode.github.io/husky/) runs [**commitlint**](https://github.com/conventional-changelog/commitlint) on the commit message (`.husky/commit-msg` → `commitlint.config.cjs`). Skipping hooks with `--no-verify` is discouraged; CI will still run the same check on pull requests.
- **IDE-style messages:** short summaries without a `type:` prefix (for example from Cursor) are **allowed**. If a line looks like a Conventional Commit (`chore: …`, `feat(scope): …`, etc.), the full **[@commitlint/config-conventional](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional)** rules apply; otherwise the hook does not block the commit. For **versioning and changelogs** on `main`, semantic-release still only recognizes conventional commit **types**—use a conventional first line for commits that should drive releases, or **squash-merge** the PR and set the squash title to a conventional message.
- **CI:** [`ci.yml`](.github/workflows/ci.yml) runs **commitlint** on pull requests (commit range from the base branch to the PR head), with the same rules as the local hook (see `commitlint.config.cjs`).

## GitHub Actions (operator)

This section is the **normative** single source of truth for CI and release workflows. Workflow YAML header comments are pointers only; behavioral rules must not live only in workflow comments.

### Default token permissions

- **[`ci.yml`](.github/workflows/ci.yml)** and **[`assurance-scheduled.yml`](.github/workflows/assurance-scheduled.yml)** declare workflow-level `permissions: contents: read` so the default `GITHUB_TOKEN` scope does not depend on repository or organization defaults.
- **[`release.yml`](.github/workflows/release.yml)** uses `permissions: contents: write`, `id-token: write`, and `issues: write` / `pull-requests: write` (for GitHub Releases). It does not use a long‑lived **npm** token: **`npm publish`** uses **Trusted Publishing (OIDC)**. Do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN` to replace OIDC.

### Unified CI (no path filters)

- **Every** `push` and **every** `pull_request` runs **[`ci.yml`](.github/workflows/ci.yml)**. There are no `paths` / `paths-ignore` filters on that workflow, so the **CI** job set is never skipped because of which files changed (website-only, docs-only, Python-only, and mixed changes all go through the same required checks). This is the **single** merge gate; there is no separate `website` or `python-verify` workflow.
- **Production** still ships **only** from the **`Vercel production`** job at the end of `ci.yml` on **`push` to `main`**, which calls **[`deploy-vercel.yml`](.github/workflows/deploy-vercel.yml)**. `website/vercel.json` keeps **`git.deploymentEnabled.main: false`**, so Vercel’s Git integration does not promote `main` by itself.

### Releases (canonical)

**Merge policy for `main`:** use **squash merge only**. Disable merge commits and rebase merges in repository settings so the squash commit subject line is always the PR title. semantic-release reads that single commit message on `main`; the PR body carries `BREAKING CHANGE:` when you need a major bump.

**Release eligibility on every PR:** [`ci.yml`](.github/workflows/ci.yml) job **`release-preview`** (**check name `CI / Release preview`**) runs [`scripts/release-preview.mjs`](scripts/release-preview.mjs) with the GitHub event payload. If `git diff` from the PR base to the PR head touches any path in [`release/preview-enforcement.paths.json`](release/preview-enforcement.paths.json), the synthetic message **`PR title + two newlines + PR body`** must be releasable under the same `@semantic-release/commit-analyzer` rules as production (shared config: [`release/commit-analyzer-rules.cjs`](release/commit-analyzer-rules.cjs)). There is **no** repository label or workflow to bypass this check; emergencies use GitHub **administrator bypass of branch protection** only.

**Required status checks (pull requests):** configure a ruleset (or classic branch protection) for `main` with **Require status checks to pass before merging** and **Require branches to be up to date before merging**, and register **exactly** these check names (format `CI / <Job name>` from workflow name `CI` in [`ci.yml`](.github/workflows/ci.yml)). PRs only: `commitlint` and `release-preview` do not run on `push`, so you **cannot** add them to “required for push to `main`” in the same way; they are **PR merge** gates. Typical setup: require all six in the table for **merging pull requests** into `main` (treat the PR’s latest run as authoritative).

| Job key | `name:` in YAML | Required status check string |
|---------|-----------------|------------------------------|
| `commitlint` | `Conventional Commits` | `CI / Conventional Commits` |
| `codeql` | `CodeQL (javascript-typescript)` | `CI / CodeQL (javascript-typescript)` |
| `test` | `test` | `CI / test` |
| `commercial` | `commercial` | `CI / commercial` |
| `python` | `Python` | `CI / Python` |
| `release-preview` | `Release preview` | `CI / Release preview` |

**Note:** `Vercel production` (from `vercel_production` in `ci.yml`) runs only on **`push` to `main`**; it is not a PR merge check.

Verify with `gh pr checks <PR> --json name,state` on a green PR: the six PR job `name` values in the table must match character-for-character.

**Validation scenarios** (local expectations + `gh` commands): see **[`docs/ci-cursor-workflow-validation.md`](docs/ci-cursor-workflow-validation.md)**.

**Release outcome visibility:** every full and dry-run `semantic-release` step in [`release.yml`](.github/workflows/release.yml) pipes logs through [`scripts/release-outcome-summarize.mjs`](scripts/release-outcome-summarize.mjs), which appends `## Release outcome` and a machine line `RELEASE_OUTCOME=<CREATED|SKIPPED_NO_RELEASABLE_COMMITS|SKIPPED_ALREADY_AT_VERSION|FAILED>` to the GitHub Actions job summary.

**First successful release bootstrap (maintainer, in order):** (1) set repository variable **`COMMERCIAL_LICENSE_API_BASE_URL`**. (2) On `main`, force-align the baseline tag to the current root [`package.json`](package.json) version: `V=$(node -p "require('./package.json').version") && git fetch origin main && git checkout main && git pull && git tag -fa "v$V" -m "release: baseline tag for semantic-release" && git push -f origin "v$V"`. (3) Merge one squash PR titled **`fix: publish release visibility and preview enforcement`** that touches an allowlisted path. (4) Confirm the `semantic-release` job summary contains **`RELEASE_OUTCOME=CREATED`**, then `git pull` on `main` and confirm `npm view agentskeptic version` matches `package.json`. (5) **Mandatory follow-up:** open a second squash PR titled **`fix: add release bootstrap verification log`** that fills in [`release/VERIFICATION.md`](release/VERIFICATION.md) with the UTC time, merge SHA, GitHub Release URL, successful `Release` workflow run link, and `npm view agentskeptic version` output (this file lives under allowlisted `release/` so CI always runs).

**Configuration:** semantic-release reads [`.releaserc.cjs`](.releaserc.cjs) at the repository root (not `.releaserc.json`).

### Automated release (single repo version: npm + PyPI + changelog)

- **When:** on every **push to `main`** that completes [**`CI`**](.github/workflows/ci.yml) successfully, [**`release.yml`**](.github/workflows/release.yml) runs **semantic-release** via `workflow_run` on that same commit when semantic-release determines a new version is needed (releasable Conventional Commit since the last [`v*.*.*`](https://github.com/semver/semver) tag).
- **What it does:** updates **[`CHANGELOG.md`](CHANGELOG.md)**, bumps the **one** shared semver in root **[`package.json`](package.json)** and [`python/pyproject.toml`](python/pyproject.toml), syncs the workspace and distribution artifacts via **`node scripts/sync-release-artifacts.mjs`** (including **`node scripts/emit-primary-marketing.cjs`** and lockfile refresh), **commits** those files, **tags** `vX.Y.Z`, creates a **GitHub Release**, and **`npm publish`** the **commercial** CLI (`prepublishOnly` → `scripts/build-commercial.mjs` with `COMMERCIAL_LICENSE_API_BASE_URL` set from the repository).
- **PyPI:** when semantic-release **pushes** the `vX.Y.Z` tag, the **`publish-pypi`** job in the same workflow file builds the wheel from [`python/`](python/) and publishes to PyPI with **Trusted Publishing (OIDC)** via `pypa/gh-action-pypi-publish`. Register this workflow as a **trusted publisher** for the `agentskeptic` project on [PyPI](https://pypi.org).

### One-time and ongoing repository settings

- **Variable (required for releases):** set [**`COMMERCIAL_LICENSE_API_BASE_URL`**](https://docs.github.com/en/actions/concepts/workflows-and-actions/variables) on the **repository** to your **production** app origin (no trailing slash, e.g. `https://app.example.com`). The Release job fails fast if it is empty when a real publish runs.
- **npm Trusted Publishing:** in the package settings on [npmjs.com](https://www.npmjs.com), the trusted GitHub Actions workflow must be **[`.github/workflows/release.yml`](.github/workflows/release.yml)** for this repository. See [npm: Trusted publishers](https://docs.npmjs.com/trusted-publishers).

**GitHub token for `semantic-release` (canonical):** [`release.yml`](.github/workflows/release.yml) uses [**`actions/create-github-app-token`**](https://github.com/actions/create-github-app-token) with repository variable **`RELEASE_APP_ID`** and secret **`RELEASE_APP_PRIVATE_KEY`**. The installed GitHub App must be allowed to **push to `main`**, open/update **Releases**, and (with rulesets) be exempted or allowed where branch protection would otherwise block the release bot’s commits and tags. This replaces ad-hoc `GITHUB_TOKEN` + PAT workarounds for protected `main`. **If you are not using a GitHub App,** re-introducing a long-lived **PAT** in secrets is a last-resort local fork concern only — the default automation in this repository **does not** use `SEMANTIC_RELEASE_GITHUB_TOKEN`; do not add it unless you have intentionally changed the workflow to read it.

### Dry-run

- Run [**Actions → Release → Run workflow**](.github/workflows/release.yml) with **dry_run** set to the default (true) to run `semantic-release --dry-run` (no version bump, tag, or publish). The job summary still receives **`RELEASE_OUTCOME=…`** from [`scripts/release-outcome-summarize.mjs`](scripts/release-outcome-summarize.mjs). This dry-run path does not require `COMMERCIAL_LICENSE_API_BASE_URL`. Alternatively: `npm run release:dry` locally (needs a clean git state and the same `origin` you expect in CI).

**Post-release validation (recommended):** run [`assurance-scheduled`](.github/workflows/assurance-scheduled.yml) after a major release, and `npm view agentskeptic version` to confirm the registry.

### CI concurrency (normative)

| Trigger | `concurrency.group` in [`ci.yml`](.github/workflows/ci.yml) | `cancel-in-progress` | Expected outcome |
|---------|-----------------|----------------------|------------------|
| `push` to **`refs/heads/main`** (and `pull_request` does not use that ref) | `${{ github.workflow }}-${{ github.ref }}` (workflow `name` is `CI`, so e.g. `CI-refs/heads/main`) | **false** | Two rapid `main` pushes may yield **two concurrent** `CI` runs; neither is cancelled by a sibling. |
| `pull_request` and **`push` to any branch other than `main`** | same `group` formula for that event’s ref | **true** | A newer run on the **same ref** cancels the older in-progress run. The latest run is the one that matters for the PR/branch. |

`cancel-in-progress` is implemented as: **`${{ github.ref != 'refs/heads/main' }}`**, so it is **false** only for the **`push`** event’s ref when the branch is **`main`**. (Feature-branch **pushes** still cancel; **`pull_request`** events use a `refs/pull/...` ref and are never `main`, so they always allow cancelation.)

### Failure modes (summary)

| Failure | System behavior |
|---------|------------------|
| Trusted Publisher / OIDC misconfiguration | `npm publish` / PyPI publish fails; there is no long-lived token fallback. |
| Registry lag after publish | The registry can be briefly behind after `npm publish`; re-run a failed job if the failure was a transient read. |
| Concurrency cancel on a feature branch | Superseded run is `cancelled`; the latest run owns the gate. |
| Duplicate version on npm / PyPI | Re-publishing the same version fails; there is no double publish for the same tag. If the release commit and tag are pushed but a registry step fails, fix the cause and re-run the failed job, or follow manual recovery. |

**Required checks after merge (non-`main` concurrency):** From `main`, create a **throwaway branch**, push two trivial commits in quick succession on that branch, and confirm the older `CI` run is **`cancelled`** and the newer run **`success`**—proving cancel-in-progress for non-`main` without changing `main`’s concurrency semantics.

## Reporting issues

- Describe expected vs actual behavior, minimal reproduction, and Node version.
- For security-sensitive reports, use **[SECURITY.md](SECURITY.md)** instead of a public issue.
