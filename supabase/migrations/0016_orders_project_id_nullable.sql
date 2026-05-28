-- Gap analysis orders have no associated project — drop the NOT NULL constraint.
alter table public.orders alter column project_id drop not null;
