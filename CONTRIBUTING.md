# Contributing

Thanks for helping improve **workflow-verifier**.

## Before you start

- Read **[README.md](README.md)** for the product model and quickest demo (`npm start`).
- Normative behavior and CLI contracts live in **[docs/workflow-verifier.md](docs/workflow-verifier.md)**; product and correctness boundaries in **[docs/verification-product-ssot.md](docs/verification-product-ssot.md)** and **[docs/correctness-definition-normative.md](docs/correctness-definition-normative.md)**.

## Development setup

- **Node.js ≥ 22.13** (see `package.json` `engines`).
- `npm install`
- `npm run build` — TypeScript compile and asset copy.
- `npm test` — default validation before a PR.

## Pull requests

- Keep changes focused; match existing style and patterns in touched files.
- If you change user-visible CLI behavior, stdout/stderr, or schemas, update the relevant **docs** and **tests** (many behaviors are guarded by doc-contract and golden tests).
- Do not duplicate normative numbers or stream contracts in the README when they belong in `docs/quick-verify-normative.md` or `docs/workflow-verifier.md`.

## Reporting issues

- Describe expected vs actual behavior, minimal reproduction, and Node version.
- For security-sensitive reports, use **[SECURITY.md](SECURITY.md)** instead of a public issue.
