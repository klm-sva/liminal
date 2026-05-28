-- Add structured JSON results column for gap analysis visual score card
alter table public.orders add column if not exists gap_analysis_results jsonb null;
