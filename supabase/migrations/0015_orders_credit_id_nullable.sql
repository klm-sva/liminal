-- Allow gap analysis orders (which have no associated credit) to be created.
alter table public.orders alter column credit_id drop not null;
