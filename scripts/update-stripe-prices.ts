/**
 * Update Stripe prices to match the current price in the credits table.
 *
 * Stripe prices are immutable — updating a price means:
 *   1. Create a new price on the same product at the new amount
 *   2. Archive (deactivate) the old price
 *   3. Update stripe_price_id in Supabase
 *
 * Only credits whose Stripe price amount doesn't match the DB price are touched.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/update-stripe-prices.ts
 */

import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// ── Load .env.local ───────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}
if (!STRIPE_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY must be set");
  process.exit(1);
}

const isLiveKey = STRIPE_KEY.startsWith("sk_live_");
console.log(`\nStripe mode: ${isLiveKey ? "🔴 LIVE" : "🟡 TEST"}`);
console.log("─".repeat(60));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

async function main() {
  const { data: credits, error } = await supabase
    .from("credits")
    .select("id, credit_code, credit_name, price, stripe_price_id, stripe_product_id")
    .eq("is_active", true)
    .not("stripe_price_id", "is", null);

  if (error) {
    console.error("ERROR fetching credits:", error.message);
    process.exit(1);
  }

  if (!credits || credits.length === 0) {
    console.log("No credits with Stripe price IDs found.");
    process.exit(0);
  }

  console.log(`Checking ${credits.length} credits for price mismatches...\n`);

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const credit of credits) {
    try {
      const stripePrice = await stripe.prices.retrieve(credit.stripe_price_id);
      const stripeAmount = stripePrice.unit_amount ?? 0;

      if (stripeAmount === credit.price) {
        skipped++;
        continue;
      }

      console.log(`[${credit.credit_code}] Price mismatch: Stripe $${(stripeAmount / 100).toFixed(0)} → DB $${(credit.price / 100).toFixed(0)}`);

      // 1. Create new price on the same product
      const newPrice = await stripe.prices.create({
        product:     credit.stripe_product_id,
        unit_amount: credit.price,
        currency:    "usd",
        metadata: {
          credit_id:   credit.id,
          credit_code: credit.credit_code,
        },
      });

      // 2. Archive the old price
      await stripe.prices.update(credit.stripe_price_id, { active: false });

      // 3. Update Supabase
      const { error: updateError } = await supabase
        .from("credits")
        .update({ stripe_price_id: newPrice.id })
        .eq("id", credit.id);

      if (updateError) throw new Error(`Supabase update failed: ${updateError.message}`);

      console.log(`   ✓ New price ID: ${newPrice.id}\n`);
      updated++;
    } catch (err) {
      console.error(`✗  [${credit.credit_code}] ERROR: ${(err as Error).message}\n`);
      failed++;
    }
  }

  console.log("─".repeat(60));
  console.log(`Done. Updated: ${updated}  Unchanged: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
