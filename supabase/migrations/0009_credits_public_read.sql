-- ============================================================
-- Liminal — Grant public read access to credits table
-- Credits are a public catalog; the anon and authenticated roles
-- need SELECT so the pricing page can query without the service key.
-- RLS policy "credits: read active" (is_active = true) still applies.
-- ============================================================

grant select on public.credits to anon;
grant select on public.credits to authenticated;
