-- Remove delivered_at = now() from sync_order_status_from_run.
-- delivered_at is set only by the deliver cron after the email is sent,
-- enforcing the 47-hour QA hold.

create or replace function sync_order_status_from_run()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update orders
    set status = 'complete'
    where id = new.order_id
      and status not in ('delivered', 'complete');
  end if;

  if new.status = 'failed' and (old.status is distinct from 'failed') then
    update orders
    set status = 'failed'
    where id = new.order_id
      and status not in ('delivered', 'complete', 'failed');
  end if;

  return new;
end;
$$;
