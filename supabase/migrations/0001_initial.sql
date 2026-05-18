-- ============================================================
-- Liminal — Initial Schema
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- Enums
-- ============================================================
create type certification_type as enum (
  'leed_bdc_v4_1',
  'well_v2',
  'well_health_safety'
);

create type certification_level as enum (
  'certified', 'silver', 'gold', 'platinum', 'annual_seal'
);

create type project_status as enum (
  'setup', 'in_progress', 'review', 'submitted', 'certified'
);

create type credit_status as enum (
  'not_started', 'in_progress', 'documentation_complete',
  'submitted', 'approved', 'denied'
);

create type member_role as enum ('owner', 'admin', 'member', 'viewer');

create type subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'unpaid'
);

create type plan_tier as enum ('starter', 'professional', 'enterprise');

-- ============================================================
-- Profiles
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text,
  avatar_url    text,
  job_title     text,
  organization_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- Organizations
-- ============================================================
create table organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  slug                text not null unique,
  logo_url            text,
  plan                plan_tier not null default 'starter',
  stripe_customer_id  text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table profiles
  add constraint profiles_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete set null;

-- ============================================================
-- Organization Members
-- ============================================================
create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            member_role not null default 'member',
  joined_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ============================================================
-- Projects
-- ============================================================
create table projects (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  address             text,
  city                text,
  state               text,
  country             text not null default 'US',
  gross_sq_ft         integer,
  certification_type  certification_type not null,
  target_level        certification_level,
  status              project_status not null default 'setup',
  target_points       integer,
  current_points      integer not null default 0,
  cover_image_url     text,
  notes               text,
  created_by          uuid not null references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index projects_organization_id_idx on projects(organization_id);
create index projects_status_idx on projects(status);

-- ============================================================
-- Credits
-- ============================================================
create table credits (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  credit_code       text not null,       -- e.g. "SS-c1", "EA-p1", "W-c1"
  category          text not null,       -- e.g. "Sustainable Sites"
  name              text not null,
  description       text,
  points_available  integer not null default 0,
  points_targeted   integer not null default 0,
  points_achieved   integer not null default 0,
  status            credit_status not null default 'not_started',
  assigned_to       uuid references profiles(id) on delete set null,
  due_date          date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, credit_code)
);

create index credits_project_id_idx on credits(project_id);
create index credits_status_idx on credits(status);

-- ============================================================
-- Documents
-- ============================================================
create table documents (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  credit_id         uuid references credits(id) on delete set null,
  name              text not null,
  description       text,
  file_type         text not null,
  file_size         bigint not null,
  storage_url       text not null,
  uploadthing_key   text not null unique,
  version           integer not null default 1,
  uploaded_by       uuid not null references profiles(id),
  created_at        timestamptz not null default now()
);

create index documents_project_id_idx on documents(project_id);
create index documents_credit_id_idx on documents(credit_id);

-- ============================================================
-- Narratives
-- ============================================================
create table narratives (
  id            uuid primary key default uuid_generate_v4(),
  credit_id     uuid not null references credits(id) on delete cascade,
  content       text not null,
  ai_generated  boolean not null default false,
  approved_by   uuid references profiles(id) on delete set null,
  approved_at   timestamptz,
  version       integer not null default 1,
  created_by    uuid not null references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index narratives_credit_id_idx on narratives(credit_id);

-- ============================================================
-- Subscriptions
-- ============================================================
create table subscriptions (
  id                       uuid primary key default uuid_generate_v4(),
  organization_id          uuid not null unique references organizations(id) on delete cascade,
  stripe_subscription_id   text not null unique,
  stripe_price_id          text not null,
  status                   subscription_status not null,
  plan                     plan_tier not null,
  current_period_start     timestamptz not null,
  current_period_end       timestamptz not null,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================
-- Updated-at triggers
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at        before update on profiles        for each row execute function update_updated_at();
create trigger organizations_updated_at   before update on organizations   for each row execute function update_updated_at();
create trigger projects_updated_at        before update on projects        for each row execute function update_updated_at();
create trigger credits_updated_at         before update on credits         for each row execute function update_updated_at();
create trigger narratives_updated_at      before update on narratives      for each row execute function update_updated_at();
create trigger subscriptions_updated_at   before update on subscriptions   for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles              enable row level security;
alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table projects              enable row level security;
alter table credits               enable row level security;
alter table documents             enable row level security;
alter table narratives            enable row level security;
alter table subscriptions         enable row level security;

-- Profiles: users see their own row
create policy "profiles: own row" on profiles
  for all using (auth.uid() = id);

-- Organizations: members of that org
create policy "organizations: members" on organizations
  for select using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Organization members: members of the same org
create policy "org_members: same org" on organization_members
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Projects: org members
create policy "projects: org members" on projects
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Credits: org members via project
create policy "credits: org members" on credits
  for all using (
    project_id in (
      select id from projects
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid()
      )
    )
  );

-- Documents: same as credits
create policy "documents: org members" on documents
  for all using (
    project_id in (
      select id from projects
      where organization_id in (
        select organization_id from organization_members
        where user_id = auth.uid()
      )
    )
  );

-- Narratives: org members via credit → project
create policy "narratives: org members" on narratives
  for all using (
    credit_id in (
      select c.id from credits c
      join projects p on p.id = c.project_id
      join organization_members om on om.organization_id = p.organization_id
      where om.user_id = auth.uid()
    )
  );

-- Subscriptions: org members
create policy "subscriptions: org members" on subscriptions
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
