import { defineConfig } from "drizzle-kit";
import { ensureDatabaseUrlForNodePgDriver } from "./src/db/ensureSslModeRequire";

const defaultLocalUrl = "postgresql://postgres:postgres@127.0.0.1:5432/wfv_telemetry";

export default defineConfig({
  schema: "./src/db/telemetrySchema.ts",
  out: "./drizzle-telemetry",
  dialect: "postgresql",
  dbCredentials: {
    url:
      ensureDatabaseUrlForNodePgDriver(process.env.TELEMETRY_DATABASE_URL?.trim() ?? "") ||
      defaultLocalUrl,
  },
});
