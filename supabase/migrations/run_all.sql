-- ============================================================
-- Liminal — Combined Schema (migrations 0002 → 0011)
-- Run once against a fresh Supabase project.
-- ============================================================

-- ============================================================
-- Teardown (safe on empty DB; protects against re-runs)
-- ============================================================
drop trigger if exists on_auth_user_created             on auth.users;
drop trigger if exists on_order_delivered_enqueue_cleanup on orders;
drop trigger if exists on_run_status_updated            on runs;
drop trigger if exists on_run_inserted                  on runs;
drop trigger if exists credits_updated_at               on credits;
drop trigger if exists projects_updated_at              on projects;

drop function if exists handle_new_customer()           cascade;
drop function if exists update_updated_at()             cascade;
drop function if exists decrement_order_runs()          cascade;
drop function if exists sync_order_status_from_run()    cascade;
drop function if exists enqueue_upload_cleanup()        cascade;
drop function if exists append_doc_profile_type(uuid, text) cascade;

drop table if exists audit_log      cascade;
drop table if exists cleanup_queue  cascade;
drop table if exists runs           cascade;
drop table if exists orders         cascade;
drop table if exists projects       cascade;
drop table if exists credits        cascade;
drop table if exists customers      cascade;

drop type if exists program_type    cascade;
drop type if exists automation_type cascade;
drop type if exists order_status    cascade;
drop type if exists run_status      cascade;

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- Enums  (includes all values added in 0003)
-- ============================================================
create type program_type as enum (
  'leed_bdc_v41',
  'well_v2',
  'well_hsr'
);

create type automation_type as enum (
  'full',
  'partial',
  'none'
);

create type order_status as enum (
  'pending_upload',
  'processing',
  'delivered',
  'failed',
  'awaiting_upload',
  'awaiting_ready',
  'under_review',
  'documents_requested',
  'awaiting_ready_final',
  'complete'
);

create type run_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ============================================================
-- customers
-- ============================================================
create table customers (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  name          text,
  organization  text,
  created_at    timestamptz not null default now()
);

comment on table customers is 'Platform end-users. Linked to auth.users.';

-- ============================================================
-- credits  (includes stripe columns from 0008)
-- ============================================================
create table credits (
  id                          uuid primary key default uuid_generate_v4(),

  program                     program_type not null,
  category                    text not null,
  credit_code                 text not null,
  credit_name                 text not null,

  points_available            integer,

  automation_type             automation_type not null,

  requirements_pdf_path       text not null,

  has_leed_form               boolean not null default false,
  leed_form_link              text,
  has_calculator              boolean not null default false,
  calculator_path             text,

  well_verification_row       integer,

  prompt_text                 text not null,
  required_customer_documents text[] not null default '{}',

  deliverable_description     text not null,
  partial_notes               text,

  price                       integer not null,
  is_active                   boolean not null default true,

  -- 0008: Stripe product/price IDs (populated by seed-stripe-products.ts)
  stripe_product_id           text,
  stripe_price_id             text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  unique (program, credit_code),

  constraint leed_form_only_leed check (
    has_leed_form = false or program = 'leed_bdc_v41'
  ),
  constraint leed_calc_only_leed check (
    has_calculator = false or program = 'leed_bdc_v41'
  ),
  constraint well_row_only_well check (
    well_verification_row is null or program in ('well_v2', 'well_hsr')
  ),
  constraint calculator_path_required check (
    not has_calculator or calculator_path is not null
  ),
  constraint price_positive check (price > 0)
);

comment on column credits.stripe_product_id is 'Stripe Product ID (prod_...). Set by seed-stripe-products.ts.';
comment on column credits.stripe_price_id   is 'Stripe Price ID (price_...). Used when creating checkout sessions.';

-- ============================================================
-- projects  (includes drawing fields from 0003, occupant fields
--            from 0004, specs_extracted from 0006,
--            doc_profiles_extracted from 0007)
-- ============================================================
create table projects (
  id                        uuid primary key default uuid_generate_v4(),
  customer_id               uuid not null references customers(id) on delete cascade,
  name                      text not null,
  address                   text,
  gross_sqft                integer,
  stories                   integer,
  building_type             text,
  occupancy                 text,
  description               text,
  programs                  program_type[] not null default '{}',
  certification_target      text,
  auto_extracted            boolean not null default false,
  flagged_fields            text[] not null default '{}',

  -- 0003: drawing analysis fields
  net_sqft                  integer,
  stories_below_grade       integer,
  primary_occupancy         text,
  secondary_occupancies     text[],
  total_parking             integer,
  accessible_parking        integer,
  bicycle_parking           integer,
  site_area_sqft            integer,
  landscaping_sqft          integer,
  impervious_sqft           integer,
  building_footprint_sqft   integer,
  dwelling_units            integer,
  occupant_load             integer,
  floor_to_floor_ft         numeric(6,2),
  floor_to_ceiling_ft       numeric(6,2),
  window_wall_ratio         numeric(5,3),
  plumbing_fixtures         jsonb,
  entrance_count            integer,
  main_entry_description    text,
  hvac_type                 text,
  lighting_type             text,
  has_renewable_energy      boolean,
  has_water_reuse           boolean,
  stormwater_features       text,
  building_orientation      text,
  sustainability_notes      text,
  drawing_data              jsonb,
  drawings_analyzed_at      timestamptz,

  -- 0004: occupant counts
  regular_occupants         integer,
  peak_visitors             integer,

  -- 0006: spec extraction flag
  specs_extracted           boolean not null default false,

  -- 0007: document profile extraction tracking
  doc_profiles_extracted    jsonb not null default '{}',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on column projects.auto_extracted         is 'True when project info was auto-populated from an uploaded drawing set.';
comment on column projects.flagged_fields         is 'Field names that could not be confidently extracted and need manual review.';
comment on column projects.drawing_data           is 'Full structured JSON extracted from drawing set by Claude vision.';
comment on column projects.drawings_analyzed_at   is 'Timestamp of most recent drawing analysis run.';
comment on column projects.regular_occupants      is 'Full-time equivalent regular occupants. Matches LEED Online registration data.';
comment on column projects.peak_visitors          is 'Maximum peak visitors at any one time. Matches LEED Online registration data.';
comment on column projects.specs_extracted        is 'True when uploaded spec documents have been pre-extracted into specs-profile.json in Storage.';

-- ============================================================
-- orders  (includes 0010 deletion_warning_sent,
--          0011 QA review columns;
--          runs_remaining default 2 and budget ≤ 2 from 0003;
--          delivered_at constraint covers both delivered+complete)
-- ============================================================
create table orders (
  id                           uuid primary key default uuid_generate_v4(),
  project_id                   uuid not null references projects(id) on delete restrict,
  customer_id                  uuid not null references customers(id) on delete restrict,
  credit_id                    uuid references credits(id) on delete restrict,  -- nullable: gap analysis orders have no credit
  status                       order_status not null default 'awaiting_upload',
  runs_used                    integer not null default 0,
  runs_remaining               integer not null default 2,
  payment_id                   text,
  created_at                   timestamptz not null default now(),
  delivered_at                 timestamptz,

  -- 0010
  deletion_warning_sent        boolean not null default false,

  -- 0011: QA review flow
  qa_status                    text not null default 'pending_review'
                                 check (qa_status in ('pending_review', 'approved', 'changes_requested')),
  qa_approved_at               timestamptz,
  qa_changes_requested_at      timestamptz,
  qa_instructions              text,
  delivery_scheduled_at        timestamptz,
  delay_email_sent             boolean not null default false,

  constraint runs_budget_check              check (runs_used + runs_remaining <= 2),
  constraint runs_used_positive             check (runs_used >= 0),
  constraint runs_remaining_non_negative    check (runs_remaining >= 0),
  constraint delivered_at_only_when_delivered check (
    (status in ('delivered', 'complete')) = (delivered_at is not null)
  )
);

comment on column orders.runs_used      is 'Incremented automatically when a run row is inserted.';
comment on column orders.runs_remaining is 'Decremented automatically when a run row is inserted.';
comment on column orders.payment_id     is 'Stripe PaymentIntent ID from the checkout.';

-- ============================================================
-- runs  (includes 0003 attempt_number, review_issues,
--        deletion_scheduled_at; run_number range 1–2 from 0003)
-- ============================================================
create table runs (
  id                     uuid primary key default uuid_generate_v4(),
  order_id               uuid not null references orders(id) on delete cascade,
  run_number             integer not null,

  customer_upload_paths  text[] not null default '{}',

  output_docx_path       text,
  output_html_path       text,
  output_form_path       text,
  output_calculator_path text,

  status                 run_status not null default 'pending',
  error_message          text,

  -- 0003
  attempt_number         integer not null default 1,
  review_issues          text[]  not null default '{}',
  deletion_scheduled_at  timestamptz,

  created_at             timestamptz not null default now(),
  completed_at           timestamptz,

  unique (order_id, run_number),

  constraint run_number_range check (run_number between 1 and 2),
  constraint completed_at_only_when_done check (
    completed_at is null or status in ('completed', 'failed')
  )
);

comment on column runs.customer_upload_paths  is 'Temporary paths in customer-uploads bucket. Deleted after delivery.';
comment on column runs.attempt_number         is '1 = first upload attempt, 2 = second upload attempt (final for this run).';
comment on column runs.review_issues          is 'Specific issues returned by document review. Empty when review passed.';
comment on column runs.deletion_scheduled_at  is 'Customer upload files are deleted 48h after this timestamp.';

-- ============================================================
-- cleanup_queue  (includes scheduled_deletion_at from 0003)
-- ============================================================
create table cleanup_queue (
  id                    uuid primary key default uuid_generate_v4(),
  order_id              uuid not null references orders(id) on delete cascade,
  file_paths            text[] not null,
  queued_at             timestamptz not null default now(),
  scheduled_deletion_at timestamptz not null default (now() + interval '48 hours'),
  processed             boolean not null default false,
  processed_at          timestamptz,

  constraint processed_at_only_when_processed check (
    (processed = true) = (processed_at is not null)
  )
);

comment on column cleanup_queue.scheduled_deletion_at is 'Files are not deleted until after this time. Default 48h from enqueue.';

-- ============================================================
-- audit_log  (from 0003)
-- ============================================================
create table audit_log (
  id          uuid        primary key default uuid_generate_v4(),
  event_type  text        not null,
  entity_type text,
  entity_id   text,
  customer_id uuid        references customers(id) on delete set null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

comment on table audit_log is 'Immutable audit trail for all significant pipeline events.';

-- ============================================================
-- Indexes
-- ============================================================
create index credits_program_idx        on credits(program);
create index credits_category_idx       on credits(category);
create index credits_active_idx         on credits(is_active) where is_active = true;
create index credits_code_search_idx    on credits using gin (credit_name gin_trgm_ops);
create index projects_customer_id_idx   on projects(customer_id);
create index orders_customer_id_idx     on orders(customer_id);
create index orders_project_id_idx      on orders(project_id);
create index orders_credit_id_idx       on orders(credit_id);
create index orders_status_idx          on orders(status);
create index runs_order_id_idx          on runs(order_id);
create index cleanup_queue_pending_idx  on cleanup_queue(queued_at) where processed = false;
create index audit_log_entity_idx       on audit_log(entity_type, entity_id);
create index audit_log_customer_idx     on audit_log(customer_id);
create index audit_log_created_idx      on audit_log(created_at desc);
create index audit_log_event_idx        on audit_log(event_type);

-- ============================================================
-- Functions
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create customer row on signup
create or replace function handle_new_customer()
returns trigger language plpgsql security definer as $$
begin
  insert into customers (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Decrement runs_remaining when a run is inserted
create or replace function decrement_order_runs()
returns trigger language plpgsql as $$
begin
  update orders
  set
    runs_used      = runs_used + 1,
    runs_remaining = runs_remaining - 1
  where id = new.order_id;
  return new;
end;
$$;

-- Advance order status when a run completes (0003 final version)
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

-- Enqueue upload cleanup on delivery (0003 final version, 48h delay)
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

-- Atomically mark a document profile type as extracted (0007)
create or replace function append_doc_profile_type(project_id uuid, doc_type text)
returns void language sql as $$
  update projects
  set doc_profiles_extracted = doc_profiles_extracted || jsonb_build_object(doc_type, true)
  where id = project_id;
$$;

-- ============================================================
-- Triggers
-- ============================================================
create trigger credits_updated_at
  before update on credits
  for each row execute function update_updated_at();

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_customer();

create trigger on_run_inserted
  after insert on runs
  for each row execute function decrement_order_runs();

create trigger on_run_status_updated
  after update of status on runs
  for each row execute function sync_order_status_from_run();

create trigger on_order_delivered_enqueue_cleanup
  after update of status on orders
  for each row execute function enqueue_upload_cleanup();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table customers      enable row level security;
alter table credits        enable row level security;
alter table projects       enable row level security;
alter table orders         enable row level security;
alter table runs           enable row level security;
alter table cleanup_queue  enable row level security;
alter table audit_log      enable row level security;

create policy "customers: own row"
  on customers for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 0009: explicit grants so anon key can read the credits catalog
create policy "credits: read active"
  on credits for select
  using (is_active = true);

create policy "projects: own"
  on projects for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "orders: own"
  on orders for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "runs: read own via order"
  on runs for select
  using (
    order_id in (
      select id from orders where customer_id = auth.uid()
    )
  );

-- audit_log and cleanup_queue: service role only, no customer policies needed

-- ============================================================
-- Storage Buckets  (0002 buckets + platform-reference from 0005)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'credit-requirements',
    'credit-requirements',
    false,
    104857600,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
  ),
  (
    'customer-uploads',
    'customer-uploads',
    false,
    52428800,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'order-outputs',
    'order-outputs',
    false,
    104857600,
    array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'platform-reference',
    'platform-reference',
    false,
    52428800,
    array[
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
      'text/markdown',
      'text/plain'
    ]
  )
on conflict (id) do nothing;

-- ============================================================
-- Storage RLS Policies
-- ============================================================

-- customer-uploads: path convention {customer_id}/{order_id}/{filename}
drop policy if exists "customer-uploads: customer insert own folder" on storage.objects;
create policy "customer-uploads: customer insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'customer-uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "customer-uploads: customer select own folder" on storage.objects;
create policy "customer-uploads: customer select own folder"
  on storage.objects for select
  using (
    bucket_id = 'customer-uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "customer-uploads: customer delete own folder" on storage.objects;
create policy "customer-uploads: customer delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'customer-uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- order-outputs: path convention {customer_id}/{order_id}/{run_number}/{filename}
drop policy if exists "order-outputs: customer select own" on storage.objects;
create policy "order-outputs: customer select own"
  on storage.objects for select
  using (
    bucket_id = 'order-outputs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- platform-reference: service role only
drop policy if exists "service_role_only_reference" on storage.objects;
create policy "service_role_only_reference"
  on storage.objects for all
  using (
    bucket_id = 'platform-reference'
    and auth.role() = 'service_role'
  );

-- ============================================================
-- Grants  (0009: allow anon + authenticated to read credits)
-- ============================================================
grant select on public.credits to anon;
grant select on public.credits to authenticated;
