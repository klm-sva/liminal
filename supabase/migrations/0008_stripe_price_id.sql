-- Liminal — Add Stripe price/product IDs to credits
-- Populated by scripts/seed-stripe-products.ts after Stripe products are created.

alter table credits
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id   text;

comment on column credits.stripe_product_id is 'Stripe Product ID for this credit (prod_...). Set by seed-stripe-products.ts.';
comment on column credits.stripe_price_id   is 'Stripe Price ID for this credit (price_...). Set by seed-stripe-products.ts. Used when creating checkout sessions.';
