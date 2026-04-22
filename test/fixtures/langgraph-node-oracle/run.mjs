/**
 * Minimal LangGraph run: one node writes one v3 tool_observed NDJSON line for wf_partner (partner quickstart contract).
 * Usage: node run.mjs <path-to-output.ndjson>
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const runEventId = randomUUID();

const ndjsonLine =
  JSON.stringify({
    schemaVersion: 3,
    workflowId: "wf_partner",
    runEventId,
    type: "tool_observed",
    seq: 0,
    toolId: "crm.upsert_contact",
    params: {
      recordId: "partner_1",
      fields: { name: "You", status: "active" },
    },
    langgraphCheckpoint: {
      threadId: "lg-ref-thread",
      checkpointNs: "",
      checkpointId: "lg-ref-cp",
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
