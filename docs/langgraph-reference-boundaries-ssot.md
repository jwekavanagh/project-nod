# Langgraph reference documentation boundaries

Canonical **Python integrator primacy** for LangGraph-shaped orchestration is **[`examples/python-verification/README.md`](../examples/python-verification/README.md)** plus **[`docs/integrator-verification-ssot.md`](integrator-verification-ssot.md)**.

A **Node oracle emitter** (minimal graph, not a product quickstart) lives under **[`test/fixtures/langgraph-node-oracle/README.md`](../test/fixtures/langgraph-node-oracle/README.md)**. Full-machine validation (emitter contract, happy path, negative `ROW_ABSENT`) runs from [`scripts/langgraph-reference-verify.mjs`](../scripts/langgraph-reference-verify.mjs) during root **`npm test`**, followed by [`scripts/assert-no-langgraph-v1-product-path.mjs`](../scripts/assert-no-langgraph-v1-product-path.mjs).

Copy-paste **shell** commands for the Node path remain in the generated **[`partner-quickstart-commands.md`](partner-quickstart-commands.md)** under **LangGraph reference (emit events, then verify)**.

## LangGraph reference documentation boundaries

| Boundary | Authoritative location | Notes |
|----------|------------------------|-------|
| Emitter strictness (v3 line, inner `params` keys) | [`scripts/lib/langgraphReferenceVerifyCore.mjs`](../scripts/lib/langgraphReferenceVerifyCore.mjs) (`assertEmitterContract`) | Throws **`langgraph-reference-verify: EMITTER_CONTRACT`** on violation |
| Prove emitter ordering before any `dist/cli.js` spawn | [`test/langgraph-reference-emitter-before-cli-spawn.test.mjs`](../test/langgraph-reference-emitter-before-cli-spawn.test.mjs) | Uses `executeLanggraphReferencePipeline` contract probe |
| Happy + negative SQLite verify driver | [`scripts/langgraph-reference-verify.mjs`](../scripts/langgraph-reference-verify.mjs) | Thin CLI; not used for R1a ordering proof |
| Minimal Node graph implementation | [`test/fixtures/langgraph-node-oracle/`](../test/fixtures/langgraph-node-oracle/) | README is prose + links only |
| Python integrator demo | [`examples/python-verification/`](../examples/python-verification/) | Kernel demo; no subprocess |
| Rendered integrator primacy (`data-testid` order, README URL) | [`website/__tests__/langgraph-reference-primacy.dom.test.tsx`](../website/__tests__/langgraph-reference-primacy.dom.test.tsx) | Filtered website Vitest in root `npm test` |
