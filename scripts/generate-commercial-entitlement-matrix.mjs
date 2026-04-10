#!/usr/bin/env node
/**
 * One-off generator: writes config/commercial-entitlement-matrix.v1.json
 * from the same rules as website/src/lib/commercialEntitlement.ts (keep in sync).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const paid = ["individual", "team", "business", "enterprise"];

function resolve({ plan, subscriptionStatus, intent, emergencyAllow }) {
  if (intent === "enforce" && plan === "starter") {
    return {
      expectProceedToQuota: false,
      expectedDenyCode: "ENFORCEMENT_REQUIRES_PAID_PLAN",
    };
  }
  if (intent === "verify" && plan === "starter") {
    return {
      expectProceedToQuota: false,
      expectedDenyCode: "VERIFICATION_REQUIRES_SUBSCRIPTION",
    };
  }
  let effectiveActive = subscriptionStatus === "active";
  if (paid.includes(plan) && emergencyAllow) {
    effectiveActive = true;
  }
  if (intent === "enforce" && paid.includes(plan) && !effectiveActive) {
    return {
      expectProceedToQuota: false,
      expectedDenyCode: "SUBSCRIPTION_INACTIVE",
    };
  }
  if (intent === "verify" && paid.includes(plan) && !effectiveActive) {
    return {
      expectProceedToQuota: false,
      expectedDenyCode: "SUBSCRIPTION_INACTIVE",
    };
  }
  return { expectProceedToQuota: true, expectedDenyCode: null };
}

const plans = ["starter", "individual", "team", "business", "enterprise"];
const subs = ["none", "active", "inactive"];
const intents = ["verify", "enforce"];
const emerg = [false, true];
const rows = [];
for (const plan of plans) {
  for (const subscriptionStatus of subs) {
    for (const intent of intents) {
      for (const emergencyAllow of emerg) {
        const r = resolve({ plan, subscriptionStatus, intent, emergencyAllow });
        rows.push({
          plan,
          subscriptionStatus,
          intent,
          emergencyAllow,
          expectProceedToQuota: r.expectProceedToQuota,
          expectedDenyCode: r.expectedDenyCode,
        });
      }
    }
  }
}

if (rows.length !== 60) throw new Error(`expected 60 rows, got ${rows.length}`);

const out = { schemaVersion: 1, rows };
writeFileSync(
  path.join(root, "config", "commercial-entitlement-matrix.v1.json"),
  JSON.stringify(out, null, 2) + "\n",
  "utf8",
);
console.log("wrote config/commercial-entitlement-matrix.v1.json");
