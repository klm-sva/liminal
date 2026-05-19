/**
 * Create Stripe products and prices for every active credit in the database.
 *
 * - Skips any credit that already has a stripe_price_id (safe to re-run)
 * - Saves stripe_product_id and stripe_price_id back to the credits table
 * - Runs in test mode by default (uses STRIPE_SECRET_KEY from .env.local,
 *   which should be a sk_test_... key during development)
 *
 * Run with:
 *   npx ts-node scripts/seed-stripe-products.ts
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_SECRET_KEY
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

// ── Validate env ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}
if (!STRIPE_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}

const isLiveKey = STRIPE_KEY.startsWith("sk_live_");
console.log(`\nStripe mode: ${isLiveKey ? "🔴 LIVE" : "🟡 TEST"}`);
console.log("─".repeat(60));

// ── Clients ───────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

// ── Program labels ────────────────────────────────────────────────────────────

const PROGRAM_LABEL: Record<string, string> = {
  leed_bdc_v41: "LEED BD+C v4.1",
  well_v2:      "WELL v2",
  well_hsr:     "WELL Health-Safety Rating",
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Fetch all active credits without a Stripe price ID
  const { data: credits, error } = await supabase
    .from("credits")
    .select("id, credit_code, credit_name, program, category, price, deliverable_description, stripe_price_id")
    .eq("is_active", true)
    .order("program")
    .order("credit_code");

  if (error) {
    console.error("ERROR fetching credits from Supabase:", error.message);
    process.exit(1);
  }

  if (!credits || credits.length === 0) {
    console.log("No active credits found in the database.");
    console.log("Run the credits seed first: supabase db seed or insert credits manually.");
    process.exit(0);
  }

  const toProcess = credits.filter((c) => !c.stripe_price_id);
  const skipped   = credits.length - toProcess.length;

  console.log(`Found ${credits.length} active credits.`);
  if (skipped > 0) console.log(`Skipping ${skipped} already have a Stripe price ID.`);
  console.log(`Creating Stripe products for ${toProcess.length} credits...\n`);

  if (toProcess.length === 0) {
    console.log("Nothing to do — all credits already have Stripe price IDs.");
    process.exit(0);
  }

  let created = 0;
  let failed  = 0;

  for (const credit of toProcess) {
    const programLabel = PROGRAM_LABEL[credit.program] ?? credit.program;
    const priceInDollars = (credit.price / 100).toFixed(2);

    try {
      // 1. Create Stripe product
      const product = await stripe.products.create({
        name:        `${credit.credit_code} — ${credit.credit_name}`,
        description: credit.deliverable_description,
        metadata: {
          credit_id:   credit.id,
          credit_code: credit.credit_code,
          program:     programLabel,
          category:    credit.category,
        },
      });

      // 2. Create one-time price linked to the product
      const price = await stripe.prices.create({
        product:    product.id,
        unit_amount: credit.price,
        currency:   "usd",
        metadata: {
          credit_id:   credit.id,
          credit_code: credit.credit_code,
        },
      });

      // 3. Save both IDs back to Supabase
      const { error: updateError } = await supabase
        .from("credits")
        .update({
          stripe_product_id: product.id,
          stripe_price_id:   price.id,
        })
        .eq("id", credit.id);

      if (updateError) {
        throw new Error(`Supabase update failed: ${updateError.message}`);
      }

      console.log(`✓  [${credit.credit_code}] ${credit.credit_name}`);
      console.log(`   Program : ${programLabel}`);
      console.log(`   Price   : $${priceInDollars} (${credit.price} cents)`);
      console.log(`   Product : ${product.id}`);
      console.log(`   Price ID: ${price.id}`);
      console.log();

      created++;
    } catch (err) {
      console.error(`✗  [${credit.credit_code}] ${credit.credit_name}`);
      console.error(`   ERROR: ${(err as Error).message}\n`);
      failed++;
    }
  }

  console.log("─".repeat(60));
  console.log(`Done. Created: ${created}  Failed: ${failed}  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log("\nRe-run the script to retry failed credits — it skips any that already succeeded.");
    process.exit(1);
  }
}

main();
