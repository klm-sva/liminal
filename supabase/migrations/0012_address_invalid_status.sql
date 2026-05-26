-- ── Add address_invalid to order_status enum ─────────────────────────────────
alter type order_status add value if not exists 'address_invalid';

-- ── Update sync trigger to propagate address_invalid run status to order ──────
create or replace function sync_order_status_from_run()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update orders
    set status = 'complete', delivered_at = now()
    where id = new.order_id
      and status not in ('delivered', 'complete');
  end if;

  if new.status = 'failed' and (old.status is distinct from 'failed') then
    update orders
    set status = 'failed'
    where id = new.order_id
      and status not in ('delivered', 'complete', 'failed');
  end if;

  if new.status = 'address_invalid' and (old.status is distinct from 'address_invalid') then
    update orders
    set status = 'address_invalid'
    where id = new.order_id
      and status not in ('delivered', 'complete', 'failed', 'address_invalid');
  end if;

  return new;
end;
$$;
