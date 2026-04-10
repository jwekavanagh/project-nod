#!/usr/bin/env node
/**
 * Idempotently ensure Stripe Product + recurring Prices for Individual, Team, and Business.
 * Run with STRIPE_SECRET_KEY set. Prints STRIPE_PRICE_* lines for .env.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY required");
  process.exit(1);
}

const stripe = new Stripe(key);

const productName = "Workflow Verifier";

async function ensurePrice(nickname, unitAmountCents) {
  const products = await stripe.products.list({ limit: 20, active: true });
  let product = products.data.find((p) => p.name === productName);
  if (!product) {
    product = await stripe.products.create({ name: productName });
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
  let price = prices.data.find(
    (p) =>
      p.recurring?.interval === "month" &&
      p.unit_amount === unitAmountCents &&
      p.currency === "usd",
  );
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmountCents,
      currency: "usd",
      recurring: { interval: "month" },
      nickname,
    });
  }
  return price.id;
}

const individual = await ensurePrice("individual-v1", 25_00);
const team = await ensurePrice("team-v1", 100_00);
const business = await ensurePrice("business-v1", 300_00);

console.log(`STRIPE_PRICE_INDIVIDUAL=${individual}`);
console.log(`STRIPE_PRICE_TEAM=${team}`);
console.log(`STRIPE_PRICE_BUSINESS=${business}`);
