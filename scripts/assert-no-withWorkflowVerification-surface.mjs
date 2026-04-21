/**
 * Fails CI if removed hook or deprecated README adoption surfaces reappear.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

let failed = false;
function ban(path, pattern, label) {
  const s = read(path);
  if (pattern.test(s)) {
    console.error(`${label}: forbidden pattern in ${path}`);
    failed = true;
  }
}

const adoptionByFile = {
  "README.md": /<!--\s*adoption-canonical:start\s*-->[\s\S]*?<!--\s*adoption-canonical:end\s*-->/,
  "llms.txt": /<!--\s*adoption-canonical-llms:start\s*-->[\s\S]*?<!--\s*adoption-canonical-llms:end\s*-->/,
};

for (const rel of ["README.md", "llms.txt"]) {
  const m = read(rel).match(adoptionByFile[rel]);
  if (!m) {
    console.error(`Missing adoption region in ${rel}`);
    failed = true;
    continue;
  }
  const region = m[0];
  if (/verifyAgentskeptic/.test(region)) {
    console.error(`${rel}: adoption region must not reference verifyAgentskeptic`);
    failed = true;
  }
  if (!/createDecisionGate/.test(region)) {
    console.error(`${rel}: adoption region must reference createDecisionGate`);
    failed = true;
  }
}

ban("README.md", /withWorkflowVerification/, "README");
ban("llms.txt", /withWorkflowVerification/, "llms.txt");

if (failed) process.exit(1);
