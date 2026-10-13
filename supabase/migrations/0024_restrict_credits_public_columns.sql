-- ============================================================
-- Liminal — Restrict public credits columns
-- 0009_credits_public_read.sql granted SELECT on the whole
-- `credits` table to anon/authenticated. RLS only filters rows
-- (is_active = true) — it does not hide columns — so prompt_text
-- (the AI prompt IP for every credit) and internal storage paths
-- were readable by anyone via the public anon key.
--
-- Fix: revoke table-wide SELECT, re-grant only on the columns
-- the customer-facing app actually reads. prompt_text,
-- requirements_pdf_path, calculator_path, leed_form_link,
-- well_verification_row, automation_type, partial_notes, the
-- stripe_* ids, and created_at/updated_at stay hidden from
-- anon/authenticated. Service-role (checkout, webhooks, admin,
-- pipeline worker) is unaffected — it bypasses table grants.
-- ============================================================

revoke select on public.credits from anon, authenticated;

grant select (
  id,
  program,
  category,
  credit_code,
  credit_name,
  points_available,
  price,
  has_form,
  has_calculator,
  deliverable_description,
  required_customer_documents,
  is_active
) on public.credits to anon, authenticated;
