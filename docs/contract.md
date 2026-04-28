# Verification Contract Manifest — SSOT

This document is the **only normative source** for the AgentSkeptic verification contract — what integrators depend on, how it is named, how it is versioned, and how it is enforced.

The contract is a **manifest**, not a bundle. The canonical schemas in [`schemas/`](../schemas) remain the only sources of truth for member shape. The manifest at [`schemas/contract/v1.json`](../schemas/contract/v1.json) names them, hashes them, and gives them a single public URL.

## §1 What it is

The Verification Contract Manifest is one JSON file with three jobs:

1. **Name** the contract members: the event-line schema, the tools-registry schema, and the tools-registry-export schema.
2. **Hash** every member and every canonical example file (`examples/tools.json`, `examples/events.ndjson`).
3. **Version** the contract under its own semver, independent from the npm package version, with an append-only `history[]` for safe upgrades.

After this change, "what is the contract?" has a single answer: the manifest.

| Surface | Location |
|---|---|
| Manifest file (committed) | [`schemas/contract/v1.json`](../schemas/contract/v1.json) |
| Manifest meta-schema | [`schemas/contract-manifest.schema.json`](../schemas/contract-manifest.schema.json) |
| Public URL (canonical site) | <https://agentskeptic.com/contract/v1.json> |
| Public URL (repo raw) | <https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/schemas/contract/v1.json> |
| `package.json` runtime pin | `verificationContractManifest = { version, manifestSha256, url }` |
| Helper script | [`scripts/contract-manifest.mjs`](../scripts/contract-manifest.mjs) |
| CI gate | `node scripts/contract-manifest.mjs --check` (in `nodeGuards`) |
| Static asset for the site | [`website/public/contract/v1.json`](../website/public/contract/v1.json) (synced from source) |

### Why this is better

- One artifact replaces narrative claims of consistency.
- One hash gate replaces every ad-hoc parity script that would otherwise multiply.
- One file is the authoritative answer to "what is the contract?"

## §2 Integrator

> **What you depend on.** The manifest's `manifestVersion`, the named members, and their hashes. Pin a version. Watch the URL. Upgrade deliberately.

**Members:**
| Role | Name | Schema |
|---|---|---|
| `event-line` | `members.event` | [`schemas/event.schema.json`](../schemas/event.schema.json) |
| `registry` | `members.toolsRegistry` | [`schemas/tools-registry.schema.json`](../schemas/tools-registry.schema.json) |
| `registry-export` | `members.toolsRegistryExport` | [`schemas/tools-registry-export.schema.json`](../schemas/tools-registry-export.schema.json) |

**Examples** (canonical fixtures, hashed alongside members so they cannot drift silently):
- `examples.registry` → [`examples/tools.json`](../examples/tools.json)
- `examples.events` → [`examples/events.ndjson`](../examples/events.ndjson)

**Runtime pin.** Read `package.json`'s `verificationContractManifest`:

```json
"verificationContractManifest": {
  "version": "1.0.1",
  "manifestSha256": "<64-hex>",
  "url": "https://agentskeptic.com/contract/v1.json"
}
```

The `manifestSha256` is the content-address of the exact bytes you depend on. If your CI fetches the URL, compare the response body's SHA-256 to this pin to detect upstream changes before any upgrade.

**Upgrade flow.** Bumps to `manifestVersion` are deliberate, not automatic. Read [`schemas/contract/changelog.json`](../schemas/contract/v1.json) (the `history` array inside the manifest) to see when each version was introduced and which member or example hashes changed. A change to any member or example without a matching history entry is rejected by the CI gate.

## §3 Engineer

> **What you do when you change a contract member.** Edit the canonical schema or example. Bump the manifest. Sync the package pin. Commit.

```bash
# 1. Edit a member schema (e.g. schemas/event.schema.json) or an example file.
# 2. Bump the manifest. Choose major/minor/patch.
node scripts/contract-manifest.mjs --bump minor

# 3. Update the package.json pin to match.
node scripts/contract-manifest.mjs --sync-package-pin

# 4. Re-sync the website static asset (or let prebuild do it).
node scripts/sync-contract-manifest-static.mjs

# 5. Verify everything is consistent.
node scripts/contract-manifest.mjs --check
```

**Other modes:**
- `--check` — used by CI; performs every assertion in `nodeGuards`.
- `--write` — re-seal the head history entry's `manifestSha256` if the manifest was rewritten without changing any member or example. Useful when fixing canonicalization only. Refuses across member changes; says to run `--bump`.
- `--bootstrap` — one-time mode to create the initial v1.0.0 manifest. Refuses if the manifest already exists.

### Error codes

The gate exits non-zero with a distinct code per failure. Fix-it line included in stderr.

| Code | Exit | Meaning |
|---|---|---|
| `CONTRACT_MANIFEST_VERSION_NOT_BUMPED` | 1 | A member or example file changed since `history[last]`. Run `--bump <kind>`. |
| `CONTRACT_MANIFEST_HASH_STALE` | 2 | The committed manifest's canonical bytes or sealed `manifestSha256` are stale. Run `--write`. |
| `CONTRACT_MANIFEST_VERSION_TOPLEVEL_MISMATCH` | 3 | `manifestVersion` does not equal `history[last].manifestVersion`. |
| `CONTRACT_MANIFEST_HISTORY_NONMONOTONIC` | 4 | `history[]` versions are not strictly ascending. |
| `CONTRACT_MANIFEST_PKG_DRIFT` | 5 | `package.json` `verificationContractManifest` does not match `history[last]`. Run `--sync-package-pin`. |
| `CONTRACT_MANIFEST_STATIC_ASSET_DRIFT` | 6 | `website/public/contract/v1.json` differs from source. Re-run the website ssot sync. |
| `CONTRACT_MANIFEST_BUMP_REQUIRED` | 7 | `--write` refused because a member or example changed; you must `--bump`. |
| `CONTRACT_MANIFEST_META_INVALID` | 8 | The manifest fails the meta-schema. |

### What the gate guarantees

- Every member's live SHA-256 equals `history[last].memberSha256.<role>`.
- Every example's live SHA-256 equals `history[last].exampleSha256.<role>`.
- The manifest's own canonical SHA-256 (with the head's `manifestSha256` zeroed) equals `history[last].manifestSha256`.
- `manifestVersion` equals `history[last].manifestVersion` and `history[]` is strictly ascending semver.
- `package.json verificationContractManifest === { version, manifestSha256, url }` taken from the head.
- When the website tree exists, `website/public/contract/v1.json` is byte-identical to the source.

## §4 Operator

The static asset at `https://agentskeptic.com/contract/v1.json` is served from the Next.js `public/` directory; there is no route handler. Cache headers follow the site's standard CDN policy. A 404 on that URL is a deployment failure — alert on it and roll back.

The manifest is content-addressable via `manifestSha256`. If the byte response of the canonical URL ever differs from the committed `schemas/contract/v1.json` for the deployed `package.json` version, treat it as a deployment integrity incident.

## §5 Reviewer

A PR that touches the contract should produce a single, structured diff in [`schemas/contract/v1.json`](../schemas/contract/v1.json):

- A new entry appended to `history[]` with a bumped `manifestVersion`, today's `introducedAt`, and updated `memberSha256` / `exampleSha256` snapshots.
- An updated top-level `manifestVersion`.
- A re-sealed `history[last].manifestSha256`.
- A matching update to `package.json verificationContractManifest`.

If a PR changes any member schema or example without these signals, the gate fails with a named error code. Reject the PR.

The bump kind (`major`, `minor`, `patch`) is the author's call. Use the existing semver guidance: breaking changes to a member's accepted shape are major; backward-compatible additions are minor; clarifications and non-shape edits are patch.

## §6 What was removed

This document replaces the prior contract prose. The following surfaces were collapsed in the same change:

- The opaque `package.json` field `"x-agentskeptic-decision-ready-contract": "1"` was deleted.
- The two definitional bullets at the top of [`docs/agentskeptic.md`](agentskeptic.md) "Why this shape" (NDJSON events + `tools.json` registry) were replaced with a single pointer line.
- The body of `## Event line schema` in [`docs/agentskeptic.md`](agentskeptic.md) (the schema-narration paragraphs) was replaced with a single pointer paragraph. The operational subsections (`### Retry and repeated seq`, capture-order rules, `canonicalJsonForParams`) are preserved.
- The intro paragraph of `## Tool registry` in [`docs/agentskeptic.md`](agentskeptic.md) was replaced with a single pointer paragraph. SQL kinds and multi-effect rules are preserved.
- The contract-identity cross-links to individual schema files in `README.md`, `llms.txt`, and `AGENTS.md` were replaced by a single Verification Contract Manifest link per surface.

If you find contract-identity prose anywhere outside this file, it is stale. Open a PR to point it here.
