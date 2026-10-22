-- ============================================================
-- Liminal — Store the Stripe Checkout Session id on orders
-- Needed so /api/orders/[orderId]/ready can verify payment status
-- directly with Stripe when payment_id hasn't been set yet by the
-- webhook (e.g. webhook delay/race), instead of trusting order
-- status alone — orders are created in "awaiting_upload" before
-- payment, which is also a valid post-upload status, so status
-- alone cannot distinguish a paid order from an abandoned checkout.
-- ============================================================

alter table orders add column if not exists stripe_session_id text;
