-- ============================================================
-- Liminal — Pipeline Schema v3
-- Adds: full order state machine, drawing analysis fields,
--       run attempt tracking, audit log, 48h cleanup scheduling
-- ============================================================

-- ── Extend order_status enum ──────────────────────────────────────────────────
-- PostgreSQL cannot remove enum values, so we add the new states alongside the
-- old ones. Old values (pending_upload, processing, delivered) are deprecated
-- for new orders — new code uses the values below exclusively.

alter type order_status add value if not exists 'awaiting_upload';
alter type order_status add value if not exists 'awaiting_ready';
alter type order_status add value if not exists 'under_review';
alter type order_status add value if not exists 'documents_requested';
alter type order_status add value if not exists 'awaiting_ready_final';
alter type order_status add value if not exists 'complete';

-- ── runs table additions ──────────────────────────────────────────────────────
alter table runs
  add column if not exists attempt_number        integer not null default 1,
  add column if not exists review_issues         text[]  not null default '{}',
  add column if not exists deletion_scheduled_at timestamptz;

comment on column runs.attempt_number        is '1 = first upload attempt, 2 = second upload attempt (final for this run).';
comment on column runs.review_issues         is 'Specific issues returned by document review. Empty when review passed.';
comment on column runs.deletion_scheduled_at is 'Customer upload files are deleted 48h after this timestamp (set on run completion).';

-- ── cleanup_queue additions ───────────────────────────────────────────────────
alter table cleanup_queue
  add column if not exists scheduled_deletion_at timestamptz not null default (now() + interval '48 hours');

comment on column cleanup_queue.scheduled_deletion_at is 'Files are not deleted until after this time. Default 48h from enqueue.';

-- Update existing rows to use 48h from queued_at
update cleanup_queue
  set scheduled_deletion_at = queued_at + interval '48 hours'
  where scheduled_deletion_at is null;

-- ── audit_log table ───────────────────────────────────────────────────────────
create table if not exists audit_log (
  id          uuid        primary key default uuid_generate_v4(),
  event_type  text        not null,   -- e.g. 'file_deleted', 'run_started', 'email_sent'
  entity_type text,                   -- 'order', 'run', 'customer', etc.
  entity_id   text,
  customer_id uuid        references customers(id) on delete set null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_entity_idx    on audit_log(entity_type, entity_id);
create index if not exists audit_log_customer_idx  on audit_log(customer_id);
create index if not exists audit_log_created_idx   on audit_log(created_at desc);
create index if not exists audit_log_event_idx     on audit_log(event_type);

alter table audit_log enable row level security;
-- audit_log: service role only — no customer-facing policies

comment on table audit_log is 'Immutable audit trail for all significant pipeline events.';

-- ── projects table: drawing analysis fields ───────────────────────────────────
alter table projects
  add column if not exists net_sqft              integer,
  add column if not exists stories_below_grade   integer,
  add column if not exists primary_occupancy     text,
  add column if not exists secondary_occupancies text[],
  add column if not exists total_parking         integer,
  add column if not exists accessible_parking    integer,
  add column if not exists bicycle_parking       integer,
  add column if not exists site_area_sqft        integer,
  add column if not exists landscaping_sqft      integer,
  add column if not exists impervious_sqft       integer,
  add column if not exists building_footprint_sqft integer,
  add column if not exists dwelling_units        integer,
  add column if not exists occupant_load         integer,
  add column if not exists floor_to_floor_ft     numeric(6,2),
  add column if not exists floor_to_ceiling_ft   numeric(6,2),
  add column if not exists window_wall_ratio      numeric(5,3),
  add column if not exists plumbing_fixtures      jsonb,
  add column if not exists entrance_count        integer,
  add column if not exists main_entry_description text,
  add column if not exists hvac_type             text,
  add column if not exists lighting_type         text,
  add column if not exists has_renewable_energy  boolean,
  add column if not exists has_water_reuse       boolean,
  add column if not exists stormwater_features   text,
  add column if not exists building_orientation  text,
  add column if not exists sustainability_notes  text,
  add column if not exists drawing_data          jsonb,     -- full raw extraction response
  add column if not exists drawings_analyzed_at  timestamptz;

comment on column projects.drawing_data         is 'Full structured JSON extracted from drawing set by Claude vision.';
comment on column projects.drawings_analyzed_at is 'Timestamp of most recent drawing analysis run.';
comment on column projects.flagged_fields       is 'Field names that returned null in drawing analysis — require manual input.';

-- ── Update enqueue_upload_cleanup to respect 48h delay ───────────────────────
create or replace function enqueue_upload_cleanup()
returns trigger language plpgsql security definer as $$
declare
  v_paths text[];
begin
  if new.status in ('delivered', 'complete') and (old.status is distinct from new.status) then
    select array_agg(f)
    into v_paths
    from (
      select unnest(customer_upload_paths) as f
      from runs
      where order_id = new.id
        and cardinality(customer_upload_paths) > 0
    ) sub;

    if v_paths is not null and cardinality(v_paths) > 0 then
      insert into cleanup_queue (order_id, file_paths, scheduled_deletion_at)
      values (new.id, v_paths, now() + interval '48 hours');
    end if;
  end if;
  return new;
end;
$$;

-- ── Update sync_order_status_from_run to handle 'complete' ───────────────────
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

  return new;
end;
$$;

-- ── Storage bucket: ensure drawings subfolder allowed in customer-uploads ─────
-- The existing RLS policy already covers all paths under {customer_id}/.
-- No policy changes needed — the folder structure is enforced at application level.

-- ── Update orders default status for new orders ───────────────────────────────
alter table orders
  alter column status set default 'awaiting_upload';

-- ── Update runs: max 2 per order (spec says 2 runs per purchase) ──────────────
-- Note: existing constraint allows 3. We add a separate constraint for new orders.
-- Cannot alter check constraints in-place — drop and recreate.
alter table runs drop constraint if exists run_number_range;
alter table runs add constraint run_number_range check (run_number between 1 and 2);

alter table orders drop constraint if exists runs_budget_check;
alter table orders add constraint runs_budget_check check (runs_used + runs_remaining <= 2);

-- Update defaults for new orders
alter table orders alter column runs_remaining set default 2;
