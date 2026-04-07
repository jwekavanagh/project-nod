/**
 * Fixed-port debug server for Playwright (compare/trust UI tests).
 * Corpus: test/fixtures/debug-ui-compare
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startDebugServerOnPort } from "../dist/debugServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const corpusRoot = path.join(root, "test", "fixtures", "debug-ui-compare");
const PORT = Number(process.env.PLAYWRIGHT_DEBUG_PORT ?? "9371");

const srv = await startDebugServerOnPort(corpusRoot, PORT);
process.stderr.write(`playwright-debug-server listening on http://127.0.0.1:${srv.port}/\n`);

function shutdown() {
  void srv.close().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
