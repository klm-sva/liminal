-- Gap analysis program type on orders (leed_bd_c, well_v2, well_hsr)
alter table public.orders add column if not exists gap_analysis_program text;

-- Questionnaire responses — one row per submission, keyed by customer + program
create table if not exists gap_analysis_responses (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid not null references customers(id) on delete cascade,
  program      text not null,
  responses    jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists gap_analysis_responses_lookup_idx
  on gap_analysis_responses(customer_id, program, created_at desc);

-- RLS: customers can only read/write their own responses
alter table public.gap_analysis_responses enable row level security;

create policy "customers_own_gap_responses" on public.gap_analysis_responses
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());
