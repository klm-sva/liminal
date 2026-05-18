-- ============================================================
-- Liminal — Platform Schema v2
-- Supersedes 0001_initial.sql (teardown + rebuild)
-- ============================================================

-- ============================================================
-- Teardown v1 schema
-- ============================================================
drop trigger if exists on_auth_user_created   on auth.users;
drop trigger if exists credits_updated_at      on credits;
drop trigger if exists projects_updated_at     on projects;
drop trigger if exists organizations_updated_at on organizations;
drop trigger if exists profiles_updated_at     on profiles;
drop trigger if exists narratives_updated_at   on narratives;
drop trigger if exists subscriptions_updated_at on subscriptions;

drop function if exists handle_new_user()         cascade;
drop function if exists update_updated_at()        cascade;

drop table if exists narratives            cascade;
drop table if exists documents             cascade;
drop table if exists subscriptions         cascade;
drop table if exists credits               cascade;
drop table if exists projects              cascade;
drop table if exists organization_members  cascade;
drop table if exists organizations         cascade;
drop table if exists profiles              cascade;

drop type if exists certification_type     cascade;
drop type if exists certification_level    cascade;
drop type if exists project_status         cascade;
drop type if exists credit_status          cascade;
drop type if exists member_role            cascade;
drop type if exists subscription_status   cascade;
drop type if exists plan_tier              cascade;

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- Enums
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
  'failed'
);

create type run_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ============================================================
-- customers
-- Linked 1:1 to Supabase Auth users
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
-- credits
-- Immutable reference catalog — one row per purchasable credit.
-- Populated by admin/seed. Never written by customers.
-- ============================================================
create table credits (
  id                          uuid primary key default uuid_generate_v4(),

  -- Identity
  program                     program_type not null,
  category                    text not null,        -- e.g. "Location & Transportation", "Air"
  credit_code                 text not null,        -- e.g. "LTc5", "A01", "SC1"
  credit_name                 text not null,

  -- Scoring (null for non-point programs like WELL H-S)
  points_available            integer,

  -- AI pipeline classification
  automation_type             automation_type not null,

  -- Storage paths (relative to credit-requirements bucket)
  requirements_pdf_path       text not null,        -- e.g. "leed/location-transportation/LTc5/requirements.pdf"

  -- LEED-specific columns (null for WELL)
  has_leed_form               boolean not null default false,
  leed_form_link              text,                 -- URL to LEED Online form page
  has_calculator              boolean not null default false,
  calculator_path             text,                 -- e.g. "leed/energy-atmosphere/EAc2/calculator.xlsx"

  -- WELL-specific columns (null for LEED)
  well_verification_row       integer,              -- 1-based row index in verification-requirements.xlsx

  -- AI processing
  prompt_text                 text not null,        -- the exact prompt injected when processing this credit
  required_customer_documents text[] not null default '{}',  -- human-readable list of required uploads

  -- Customer-facing
  deliverable_description     text not null,        -- what the customer receives on completion
  partial_notes               text,                 -- explains what cannot be automated (partial only)

  -- Commerce
  price                       integer not null,     -- in cents (USD)
  is_active                   boolean not null default true,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  unique (program, credit_code),

  -- Constraints: LEED-only fields must be null for non-LEED
  constraint leed_form_only_leed check (
    has_leed_form = false or program = 'leed_bdc_v41'
  ),
  constraint leed_calc_only_leed check (
    has_calculator = false or program = 'leed_bdc_v41'
  ),
  -- WELL verification row only for WELL programs
  constraint well_row_only_well check (
    well_verification_row is null or program in ('well_v2', 'well_hsr')
  ),
  -- calculator_path required when has_calculator is true
  constraint calculator_path_required check (
    not has_calculator or calculator_path is not null
  ),
  -- price must be positive
  constraint price_positive check (price > 0)
);

comment on table  credits is 'Purchasable credit documentation packages — the product catalog.';
comment on column credits.requirements_pdf_path is 'Path relative to the credit-requirements storage bucket.';
comment on column credits.well_verification_row is '1-based row in well-v2/verification-requirements.xlsx or well-hsr/verification-requirements.xlsx.';
comment on column credits.prompt_text is 'Injected verbatim into the AI call for this specific credit. Must be credit-scoped.';
comment on column credits.price is 'In US cents.';

-- ============================================================
-- projects
-- A customer''s building project — anchor for all orders
-- ============================================================
create table projects (
  id                   uuid primary key default uuid_generate_v4(),
  customer_id          uuid not null references customers(id) on delete cascade,
  name                 text not null,
  address              text,
  gross_sqft           integer,
  stories              integer,
  building_type        text,
  occupancy            text,
  description          text,
  programs             program_type[] not null default '{}',
  certification_target text,
  auto_extracted       boolean not null default false,
  flagged_fields       text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column projects.auto_extracted  is 'True when project info was auto-populated from an uploaded drawing set.';
comment on column projects.flagged_fields  is 'Field names that could not be confidently extracted and need manual review.';

-- ============================================================
-- orders
-- One row per (project × credit) purchase
-- Each order allows up to 3 AI processing runs
-- ============================================================
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete restrict,
  customer_id     uuid not null references customers(id) on delete restrict,
  credit_id       uuid not null references credits(id) on delete restrict,
  status          order_status not null default 'pending_upload',
  runs_used       integer not null default 0,
  runs_remaining  integer not null default 3,
  payment_id      text,           -- Stripe PaymentIntent ID
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,

  -- Integrity
  constraint runs_budget_check   check (runs_used + runs_remaining <= 3),
  constraint runs_used_positive  check (runs_used >= 0),
  constraint runs_remaining_non_negative check (runs_remaining >= 0),
  constraint delivered_at_only_when_delivered check (
    (status = 'delivered') = (delivered_at is not null)
  )
);

comment on table  orders is 'One order = one credit purchased for one project. Allows up to 3 runs.';
comment on column orders.runs_used       is 'Incremented automatically when a run row is inserted.';
comment on column orders.runs_remaining  is 'Decremented automatically when a run row is inserted.';
comment on column orders.payment_id      is 'Stripe PaymentIntent ID from the checkout.';

-- ============================================================
-- runs
-- Each AI processing attempt within an order
-- ============================================================
create table runs (
  id                     uuid primary key default uuid_generate_v4(),
  order_id               uuid not null references orders(id) on delete cascade,
  run_number             integer not null,

  -- Input files (paths in customer-uploads bucket, deleted after delivery)
  customer_upload_paths  text[] not null default '{}',

  -- Output files (paths in order-outputs bucket)
  output_docx_path       text,
  output_html_path       text,
  output_form_path       text,         -- nullable: LEED credits with pre-populated form
  output_calculator_path text,         -- nullable: LEED credits with calculator output

  status                 run_status not null default 'pending',
  error_message          text,
  created_at             timestamptz not null default now(),
  completed_at           timestamptz,

  unique (order_id, run_number),

  constraint run_number_range check (run_number between 1 and 3),
  constraint completed_at_only_when_done check (
    completed_at is null or status in ('completed', 'failed')
  )
);

comment on table  runs is 'One row per AI processing run. Up to 3 per order.';
comment on column runs.customer_upload_paths  is 'Temporary paths in customer-uploads bucket. Deleted after delivery.';
comment on column runs.output_docx_path       is 'Path in order-outputs bucket. Permanent until customer deletes.';

-- ============================================================
-- cleanup_queue
-- Populated automatically when an order is delivered.
-- Processed by the delete-customer-uploads Edge Function.
-- ============================================================
create table cleanup_queue (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references orders(id) on delete cascade,
  file_paths   text[] not null,
  queued_at    timestamptz not null default now(),
  processed    boolean not null default false,
  processed_at timestamptz,

  constraint processed_at_only_when_processed check (
    (processed = true) = (processed_at is not null)
  )
);

comment on table cleanup_queue is 'Queue of customer upload files to delete. Drained by the delete-customer-uploads Edge Function.';

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

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger credits_updated_at  before update on credits  for each row execute function update_updated_at();
create trigger projects_updated_at before update on projects for each row execute function update_updated_at();

-- ============================================================
-- Auto-create customer row on auth.users insert
-- ============================================================
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_customer();

-- ============================================================
-- Auto-decrement runs_remaining when a run is inserted
-- ============================================================
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

create trigger on_run_inserted
  after insert on runs
  for each row execute function decrement_order_runs();

-- ============================================================
-- Auto-advance order status on run completion
-- ============================================================
create or replace function sync_order_status_from_run()
returns trigger language plpgsql as $$
begin
  -- Run completed successfully → deliver the order
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    update orders
    set
      status       = 'delivered',
      delivered_at = now()
    where id = new.order_id
      and status not in ('delivered');  -- idempotent
  end if;

  -- Run failed → mark order failed unless it was already delivered
  if new.status = 'failed' and (old.status is distinct from 'failed') then
    update orders
    set status = 'failed'
    where id = new.order_id
      and status not in ('delivered', 'failed');
  end if;

  return new;
end;
$$;

create trigger on_run_status_updated
  after update of status on runs
  for each row execute function sync_order_status_from_run();

-- ============================================================
-- Auto-enqueue cleanup when order is delivered
-- ============================================================
create or replace function enqueue_upload_cleanup()
returns trigger language plpgsql security definer as $$
declare
  v_paths text[];
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered') then
    -- Collect all customer upload paths across all runs for this order
    select array_agg(f)
    into v_paths
    from (
      select unnest(customer_upload_paths) as f
      from runs
      where order_id = new.id
        and cardinality(customer_upload_paths) > 0
    ) sub;

    if v_paths is not null and cardinality(v_paths) > 0 then
      insert into cleanup_queue (order_id, file_paths)
      values (new.id, v_paths);
    end if;
  end if;
  return new;
end;
$$;

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

-- customers: own row only
create policy "customers: own row"
  on customers for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- credits: public read of active credits; only service role writes
create policy "credits: read active"
  on credits for select
  using (is_active = true);

-- projects: own projects
create policy "projects: own"
  on projects for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- orders: own orders
create policy "orders: own"
  on orders for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- runs: customer can read their runs; only service role inserts/updates
create policy "runs: read own via order"
  on runs for select
  using (
    order_id in (
      select id from orders where customer_id = auth.uid()
    )
  );

-- cleanup_queue: service role only (no customer access)
-- No policies needed — service role bypasses RLS

-- ============================================================
-- Storage Buckets
-- ============================================================

-- 1. credit-requirements  — private, system-read-only
-- 2. customer-uploads     — private, customer writes own folder
-- 3. order-outputs        — private, customer reads own folder

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'credit-requirements',
    'credit-requirements',
    false,
    104857600,    -- 100 MB per file
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
    52428800,     -- 50 MB per file
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
  )
on conflict (id) do nothing;

-- ============================================================
-- Storage RLS Policies
-- ============================================================

-- credit-requirements: NO authenticated user policies.
-- Only the service role (used server-side) can read/write.
-- This ensures credit data is never directly accessible from the browser.

-- customer-uploads
-- Path convention: {customer_id}/{order_id}/{filename}

create policy "customer-uploads: customer insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'customer-uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "customer-uploads: customer select own folder"
  on storage.objects for select
  using (
    bucket_id = 'customer-uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "customer-uploads: customer delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'customer-uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- order-outputs
-- Path convention: {customer_id}/{order_id}/{run_number}/{filename}

create policy "order-outputs: customer select own"
  on storage.objects for select
  using (
    bucket_id = 'order-outputs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
