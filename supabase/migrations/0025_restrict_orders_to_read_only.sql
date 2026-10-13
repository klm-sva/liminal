-- ============================================================
-- Liminal — Restrict orders RLS to read-only for customers
-- "orders: own" (0002_platform_schema.sql) was `for all` using
-- (customer_id = auth.uid()), meaning a customer could directly
-- PATCH their own order's project_id or credit_id via the
-- Supabase REST API — e.g. swapping credit_id to a more
-- expensive credit after paying for a cheaper one, or swapping
-- project_id to pull another customer's project data into their
-- own deliverable (pipeline/process-order.ts fetches the full
-- project row via service-role client using only order.project_id).
--
-- Every legitimate insert/update/delete on orders already goes
-- through API routes using the service-role client (checkout,
-- webhooks/stripe, /run, /ready, admin routes, internal
-- process-order) — none of it relies on anon/authenticated
-- write access. Customer-facing pages only ever read orders.
-- So removing write access via RLS closes the hole with zero
-- impact on app behavior.
-- ============================================================

drop policy if exists "orders: own" on orders;

create policy "orders: own (read only)"
  on orders for select
  using (customer_id = auth.uid());
