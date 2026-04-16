# Langgraph reference documentation boundaries

This document is the **SSOT** for **where LangGraph-shaped integrator material may live** and **which tests enforce emitter vs CLI ordering**. It is **not** product positioning—that remains in [`verification-product-ssot.md`](verification-product-ssot.md).

Canonical integrator **primacy** for LangGraph-shaped orchestration is the repository [`examples/langgraph-reference/README.md`](../examples/langgraph-reference/README.md) plus the generated shell in [`partner-quickstart-commands.md`](partner-quickstart-commands.md). Full-machine validation (emitter contract, happy path, negative `ROW_ABSENT`) runs from [`scripts/langgraph-reference-verify.mjs`](../scripts/langgraph-reference-verify.mjs) during root **`npm test`**.

| Boundary | Authoritative location | Notes |
|----------|------------------------|-------|
| Emitter strictness (`tool_observed` line, inner `params` keys) | [`scripts/lib/langgraphReferenceVerifyCore.mjs`](../scripts/lib/langgraphReferenceVerifyCore.mjs) (`assertEmitterContract`) | Throws **`langgraph-reference-verify: EMITTER_CONTRACT`** on violation |
| Prove emitter ordering before any `dist/cli.js` spawn | [`test/langgraph-reference-emitter-before-cli-spawn.test.mjs`](../test/langgraph-reference-emitter-before-cli-spawn.test.mjs) | Uses `executeLanggraphReferencePipeline` contract probe |
| Happy + negative SQLite verify driver | [`scripts/langgraph-reference-verify.mjs`](../scripts/langgraph-reference-verify.mjs) | Thin CLI; not used for R1a ordering proof |
| Copy-paste emit + verify commands | Generated [`partner-quickstart-commands.md`](partner-quickstart-commands.md) § LangGraph reference | Do not duplicate fenced commands in the LangGraph README |
| Minimal graph implementation | [`examples/langgraph-reference/`](../examples/langgraph-reference/) | README is prose + links only |
| Rendered integrator primacy (`data-testid` order, README URL) | [`website/__tests__/langgraph-reference-primacy.dom.test.tsx`](../website/__tests__/langgraph-reference-primacy.dom.test.tsx) | Filtered website Vitest in root `npm test` |
| Script chain (`partner-quickstart` before LangGraph driver; Vitest ordering) | [`test/npm-scripts-contract.test.mjs`](../test/npm-scripts-contract.test.mjs) | Guardrails on root `package.json` |
