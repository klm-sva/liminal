-- ============================================================
-- Liminal — Add deletion_warning_sent to orders
-- Tracks whether the 48-hour file-expiry warning email has
-- already been sent for an order, preventing duplicate sends
-- from the hourly cleanup cron job.
-- ============================================================

alter table public.orders
  add column if not exists deletion_warning_sent boolean not null default false;
