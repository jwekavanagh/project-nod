/**
 * Minimal LangGraph run: one node writes one tool_observed NDJSON line for wf_partner (partner quickstart contract).
 * Usage: node run.mjs <path-to-output.ndjson>
 */
import { writeFileSync } from "node:fs";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const ndjsonLine =
  JSON.stringify({
    schemaVersion: 1,
    workflowId: "wf_partner",
    seq: 0,
    type: "tool_observed",
    toolId: "crm.upsert_contact",
    params: {
      recordId: "partner_1",
      fields: { name: "You", status: "active" },
    },
  }) + "\n";

const StateAnnotation = Annotation.Root({
  outputPath: Annotation(),
});

const graph = new StateGraph(StateAnnotation)
  .addNode("emit", (state) => {
    writeFileSync(state.outputPath, ndjsonLine, "utf8");
    return {};
  })
  .addEdge(START, "emit")
  .addEdge("emit", END);

const app = graph.compile();

const outPath = process.argv[2];
if (!outPath) {
  console.error("Usage: node run.mjs <path-to-output.ndjson>");
  process.exit(1);
}

await app.invoke({ outputPath: outPath });
