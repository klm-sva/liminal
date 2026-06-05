/**
 * One-time script: seed Stripe live mode products and prices from the credits table.
 *
 * Run with:
 *   STRIPE_SECRET_KEY=sk_live_... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx ts-node --project tsconfig.json pipeline/seed-stripe-live.ts
 *
 * Or set those vars in your .env.local and run:
 *   npx ts-node --project tsconfig.json pipeline/seed-stripe-live.ts
 *
 * Safe to re-run — skips any credit that already has a live stripe_price_id.
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_KEY  = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required env vars: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!STRIPE_KEY.startsWith("sk_live_")) {
  console.error("STRIPE_SECRET_KEY must be a live key (sk_live_...). Aborting.");
  process.exit(1);
}

const stripe   = new Stripe(STRIPE_KEY, { apiVersion: "2025-02-24.acacia", typescript: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("Fetching credits from Supabase...");

  const { data: credits, error } = await supabase
    .from("credits")
    .select("id, credit_name, credit_code, price, stripe_price_id")
    .eq("is_active", true)
    .order("credit_code");

  if (error || !credits) {
    console.error("Failed to fetch credits:", error?.message);
    process.exit(1);
  }

  console.log(`Found ${credits.length} active credits.\n`);

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const credit of credits) {
    // Skip if already has a live price ID
    if (credit.stripe_price_id?.startsWith("price_") ) {
      // Check if it's already a live price by trying to retrieve it
      try {
        const existing = await stripe.prices.retrieve(credit.stripe_price_id);
        if (existing && !existing.livemode === false) {
          // Already a live price
          console.log(`  SKIP  ${credit.credit_code} — already has live price ${credit.stripe_price_id}`);
          skipped++;
          continue;
        }
      } catch {
        // Price doesn't exist in live mode — fall through to create
      }
    }

    try {
      // Create product
      const product = await stripe.products.create({
        name:     credit.credit_name,
        metadata: { credit_code: credit.credit_code, credit_id: credit.id },
      });

      // Create price (price is stored in cents in DB)
      const price = await stripe.prices.create({
        product:     product.id,
        unit_amount: credit.price,
        currency:    "usd",
        metadata:    { credit_code: credit.credit_code, credit_id: credit.id },
      });

      // Write back to Supabase
      const { error: updateErr } = await supabase
        .from("credits")
        .update({
          stripe_product_id: product.id,
          stripe_price_id:   price.id,
        })
        .eq("id", credit.id);

      if (updateErr) {
        console.error(`  ERROR updating DB for ${credit.credit_code}: ${updateErr.message}`);
        failed++;
      } else {
        console.log(`  OK    ${credit.credit_code} — ${product.id} / ${price.id}`);
        created++;
      }
    } catch (err) {
      console.error(`  ERROR creating Stripe records for ${credit.credit_code}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) {
    console.log("Re-run the script to retry failed items.");
    process.exit(1);
  }
}

run();
