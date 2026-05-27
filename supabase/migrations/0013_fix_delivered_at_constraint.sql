-- Fix check constraint: allow delivered_at to be set when status = 'complete'
-- The sync trigger sets delivered_at = now() on order when run.status → 'completed'.
-- The old constraint only allowed status = 'delivered', causing a constraint violation
-- and silently rolling back every run status update (orders stuck at 'pending').
alter table public.orders
  drop constraint if exists delivered_at_only_when_delivered;

alter table public.orders
  add constraint delivered_at_only_when_delivered check (
    (status in ('delivered', 'complete')) = (delivered_at is not null)
  );

-- Add address_invalid to run_status enum so Step 7.5 can write it without silent failure
alter type run_status add value if not exists 'address_invalid';
