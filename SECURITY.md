# Security

## Supported versions

Security updates are applied to the **default branch** of this repository. Use the latest commit or published release you trust.

## Reporting a vulnerability

Please **do not** file a public GitHub issue for undisclosed security vulnerabilities.

Instead, report privately:

1. Open a **GitHub Security Advisory** for this repository (preferred if enabled), or  
2. Contact the maintainers through a private channel they have published for this project.

Include:

- A short description of the issue and its impact  
- Steps to reproduce (proof-of-concept if possible)  
- Affected versions or commit range if known  

We will work with you to understand and address the report before public disclosure.

## Scope notes

This tool runs **read-only SQL** against databases you configure and processes **local files** (events, registry, etc.). Threat models should account for **untrusted input files**, **database connectivity**, and **supply chain** (dependencies) like any Node.js CLI.

For how enforced dependency pins and merge-gated Drizzle static checks are defined, see **CONTRIBUTING** under **Dependency security (merge gate vs policy)**.

## API keys: lookup fingerprint vs verification

Website API keys use two stored artifacts:

- **`keyLookupSha256`** — a **SHA-256 hex digest** produced only by **`sha256HexApiKeyLookupFingerprint`** in [`website/src/lib/apiKeyCrypto.ts`](website/src/lib/apiKeyCrypto.ts). It exists for **indexed database lookup** (constant-time row fetch), not as the sole proof of possession.
- **`keyHash`** — a **scrypt** hash from **`hashApiKey`**, verified only through **`verifyApiKey`**.

Plaintext keys are **`PREFIX + randomBytes(32)`** hex (high entropy). Do not use the SHA-256 helper for human passwords or as a standalone verifier.

## Debug server (localhost) and HTTP error boundaries

The corpus **debug server** ([`src/debugServer.ts`](src/debugServer.ts)) listens on **`127.0.0.1`**. Internal failures use HTTP **500** responses with a **fixed opaque** body (`DEBUG_SERVER_OPAQUE_500_MESSAGE`) and a stable **`code`** string; detailed errors (including validator payloads and exception objects) are written to **stderr** with the prefix **`[debug-internal]`** (`DEBUG_SERVER_INTERNAL_STDERR_PREFIX`). Operators diagnose failures from the process logs, not from HTTP JSON bodies.

## Code scanning posture (CodeQL)

Pull requests are expected to pass the **`codeql`** job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml): **`github/codeql-action`** runs **`security-and-quality`** on **JavaScript/TypeScript**, then **`scripts/assert-codeql-remediation-sarif.mjs`** reads the **`sarif-output`** directory from the **`analyze`** step and **fails the job** if any SARIF result uses one of these rule IDs:

- `js/incomplete-url-substring-sanitization`
- `js/double-escaping`
- `js/insufficient-password-hash`
- `js/stack-trace-exposure`

Inline suppressions use the line-before **`// codeql[js/<rule-id>]: …`** form described in [GitHub CodeQL PR #11723](https://github.com/github/codeql/pull/11723).

URL-substring, stack-trace, and double-escaping findings are addressed primarily by **test and runtime refactors**. For example, HTML normalization in [`website/__tests__/marketing-public-routes.dom.test.ts`](website/__tests__/marketing-public-routes.dom.test.ts) uses **JSDOM** parsing instead of manual entity replacement, which avoids **`js/double-escaping`** alerts without a suppression.

The **only** inline suppression in this repository documents a scanner false positive where the rule does not match the intended threat model: **`js/insufficient-password-hash`** on the SHA-256 lookup fingerprint in [`website/src/lib/apiKeyCrypto.ts`](website/src/lib/apiKeyCrypto.ts) (indexed lookup only; possession is verified with **scrypt** in **`verifyApiKey`**).
