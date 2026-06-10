-- Drop the biconditional constraint that required delivered_at to be set
-- whenever status = 'complete'. With the new delivery architecture, status = 'complete'
-- means QA pending and delivered_at is set later by the deliver cron after the
-- 47-hour hold. The two fields are intentionally decoupled.
alter table public.orders
  drop constraint if exists delivered_at_only_when_delivered;
