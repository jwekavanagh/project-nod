#!/usr/bin/env node
// Activation surface drift gate: website App Router api/v1 and api/oss route.ts files,
// plus api/public/verification-reports/route.ts, must match OpenAPI paths (and vice versa).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = join(root, "website", "src", "app", "api");
const openApiPath = join(root, "schemas", "openapi-commercial-v1.yaml");

function walkRouteTs(dir, segPrefix) {
  const paths = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return paths;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      paths.push(...walkRouteTs(p, [...segPrefix, ent.name]));
    } else if (ent.isFile() && ent.name === "route.ts" && segPrefix.length > 0) {
      paths.push(`/api/${segPrefix.join("/")}`);
    }
  }
  return paths;
}

function diskActivationPaths() {
  const s = new Set();
  for (const p of walkRouteTs(join(apiRoot, "v1"), ["v1"])) s.add(p);
  for (const p of walkRouteTs(join(apiRoot, "oss"), ["oss"])) s.add(p);
  const pub = join(apiRoot, "public", "verification-reports", "route.ts");
  if (statSync(pub, { throwIfNoEntry: false })?.isFile()) {
    s.add("/api/public/verification-reports");
  }
  return s;
}

function openapiActivationPaths(doc) {
  const paths = doc.paths && typeof doc.paths === "object" ? Object.keys(doc.paths) : [];
  const s = new Set();
  for (const k of paths) {
    if (
      k.startsWith("/api/v1/") ||
      k.startsWith("/api/oss/") ||
      k === "/api/public/verification-reports"
    ) {
      s.add(k);
    }
  }
  return s;
}

const disk = diskActivationPaths();
const doc = parse(readFileSync(openApiPath, "utf8"));
const spec = openapiActivationPaths(doc);

const missingInOpenApi = [...disk].filter((p) => !spec.has(p)).sort();
const orphanInOpenApi = [...spec].filter((p) => !disk.has(p)).sort();

if (missingInOpenApi.length || orphanInOpenApi.length) {
  console.error("[assert-openapi-covers-activation-routes] Mismatch between disk routes and OpenAPI paths.");
  if (missingInOpenApi.length) {
    console.error("  On disk but missing from OpenAPI:", missingInOpenApi.join(", "));
  }
  if (orphanInOpenApi.length) {
    console.error("  In OpenAPI but no matching route file:", orphanInOpenApi.join(", "));
  }
  process.exit(1);
}

console.error("[assert-openapi-covers-activation-routes] OK:", [...disk].sort().join(", "));
