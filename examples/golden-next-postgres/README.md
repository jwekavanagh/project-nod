# Golden reference: Next.js + Postgres

This directory is the canonical copy-and-run reference for first verification.

## Run

From repository root:

```bash
npm run golden:path
```

Or from this directory:

```bash
node scripts/run-reference.mjs
```

Set `POSTGRES_ADMIN_URL` in `.env` (copied from `.env.example`) before running.

The runner verifies both:

- a trusted pass (`VERDICT: complete` semantics)
- an actionable failure (`ROW_ABSENT`)

`app/api/verify/route.ts` shows the production Next.js App Router integration shape.
