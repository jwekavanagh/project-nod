import fs from "fs";
import path from "path";

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== "dist") walk(p);
    else if (e.isFile() && e.name.endsWith(".json")) {
      let raw;
      try {
        raw = fs.readFileSync(p, "utf8");
      } catch {
        continue;
      }
      if (!raw.includes('"runLevelCodes"')) continue;
      let j;
      try {
        j = JSON.parse(raw);
      } catch {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(j, "runLevelCodes")) delete j.runLevelCodes;
      if (j.schemaVersion === 9) j.schemaVersion = 10;
      if (j.schemaVersion === 6 && j.workflowTruthReport === undefined && j.workflowId !== undefined) {
        j.schemaVersion = 7;
      }
      const out = JSON.stringify(j) + (raw.endsWith("\n") ? "\n" : "");
      fs.writeFileSync(p, out);
      console.log("migrated", p);
    }
  }
}

walk("test");
walk("examples");
walk("src");
