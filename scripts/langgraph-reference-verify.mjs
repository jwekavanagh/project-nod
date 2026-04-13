#!/usr/bin/env node
import { executeLanggraphReferencePipeline } from "./lib/langgraphReferenceVerifyCore.mjs";

try {
  executeLanggraphReferencePipeline();
  process.exit(0);
} catch (e) {
  process.stderr.write(String(e?.message ?? e) + "\n");
  process.exit(1);
}
