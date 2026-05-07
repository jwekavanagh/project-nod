#!/usr/bin/env node
/**
 * Product-path guard: Python-first LangGraph example must exist alongside the Node reference emitter.
 * Regression guard: LangGraph checkpoint-trust statute anchor remains in docs/integrator-verification.md.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pyEx = path.join(root, "examples", "python-verification");
const integrator = path.join(root, "docs", "integrator-verification.md");

if (!existsSync(pyEx)) {
  console.error("assert-python-langgraph-primacy: missing examples/python-verification");
  process.exit(1);
}
if (!existsSync(integrator)) {
  console.error("assert-python-langgraph-primacy: missing docs/integrator-verification.md");
  process.exit(1);
}

const statute = readFileSync(integrator, "utf8");
if (!statute.includes('<a id="langgraph-checkpoint-trust"></a>')) {
  console.error(
    'assert-python-langgraph-primacy: docs/integrator-verification.md missing <a id="langgraph-checkpoint-trust"></a>',
  );
  process.exit(1);
}
if (!statute.includes("## LangGraph checkpoint trust")) {
  console.error(
    'assert-python-langgraph-primacy: docs/integrator-verification.md missing "## LangGraph checkpoint trust" heading',
  );
  process.exit(1);
}
console.log("assert-python-langgraph-primacy: ok");
