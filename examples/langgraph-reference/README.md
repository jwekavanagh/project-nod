# LangGraph reference (quickstart-contract emit)

This package is a **minimal** LangGraph graph that writes **one** NDJSON line to a file path you pass to `run.mjs`. The line uses the same `tool_observed` shape as the bundled integration quickstart (`wf_partner`, `crm.upsert_contact`, strict `params`), so you can verify it with `examples/partner-quickstart/partner.tools.json` and the same seed SQL as in `examples/partner-quickstart/`.

**Commands** for install, emit, and `node dist/cli.js` verification live in the generated document [partner-quickstart-commands.md](../../docs/partner-quickstart-commands.md) under **LangGraph reference (emit events, then verify)** — this README stays prose-only (no fenced shell blocks) so drift is impossible between copy-paste steps and CI.

**Product documentation boundaries** (what belongs in SSOT vs this folder) are defined only in [langgraph-reference-boundaries-ssot.md](../../docs/langgraph-reference-boundaries-ssot.md#langgraph-reference-documentation-boundaries). Do not duplicate the authority matrix here.
