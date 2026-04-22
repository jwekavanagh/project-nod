#!/usr/bin/env node
/**
 * Product-path guard: Python-first LangGraph example must exist alongside the Node reference emitter.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pyEx = path.join(root, "examples", "python-verification");
const integrator = path.join(root, "docs", "integrator-verification-ssot.md");

if (!existsSync(pyEx)) {
  console.error("assert-python-langgraph-primacy: missing examples/python-verification");
  process.exit(1);
}
if (!existsSync(integrator)) {
  console.error("assert-python-langgraph-primacy: missing docs/integrator-verification-ssot.md");
  process.exit(1);
}
console.log("assert-python-langgraph-primacy: ok");
