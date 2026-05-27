alter table public.runs
  add column if not exists compliance_path text;
