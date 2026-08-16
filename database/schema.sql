-- ============================================================================
-- MAHARASHTRA RAILWAY INFORMATION HUB — PHASE 2 SCHEMA (security-hardened)
-- Target: Postgres (Supabase). Free tier is sufficient for v1.
-- Tables are ordered so each statement only references tables already
-- created above it. Safe to run top-to-bottom on a fresh database.
-- Run this file, then database/rls_policies.sql, in that order.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enums (mirror the constants already used in data/data.js so the API
--    response can be swapped in for the static file with no frontend change)
-- ---------------------------------------------------------------------------
create type verification_status as enum (
  'NEW', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'ARCHIVED'
);

create type project_status as enum (
  'PROPOSED','SURVEY','FLS_COMPLETED','DPR_PREPARED','DPR_REVISED',
  'UNDER_EXAMINATION','PENDING_RAILWAY_BOARD','SANCTIONED','LAND_ACQUISITION',
  'TENDER','UNDER_CONSTRUCTION','PARTIALLY_COMPLETED','COMPLETED','ON_HOLD',
  'DROPPED','ARCHIVED'
);

create type project_category as enum (
  'NEW_LINE','DOUBLING','TRIPLING','GAUGE_CONVERSION','ELECTRIFICATION',
  'STATION_DEVELOPMENT','STATION_REDEVELOPMENT','ROB','RUB','BRIDGE',
  'TUNNEL','SIGNALLING','TRACK','SERVICE','OTHER'
);

create type source_type as enum (
  'OFFICIAL_WEBSITE','RTI_REPLY','PARLIAMENT_RECORD','PRESS_RELEASE',
  'NEWS_ARTICLE','TENDER_NOTICE','PINK_BOOK','RTI_PORTAL','SOCIAL_MEDIA','OTHER'
);

create type user_role as enum (
  'SUPER_ADMIN','EDITOR','VERIFIER','VIEWER'
);

create type service_change_type as enum (
  'NEW_SERVICE','EXTENSION','FREQUENCY_CHANGE','SPECIAL_TRAIN',
  'STOPPAGE_ADDED','STOPPAGE_REMOVED','OTHER'
);

-- ---------------------------------------------------------------------------
-- 2. sources — the configurable source registry. No dependencies.
--    SECURITY FIX (review item 1): is_active now defaults to false. A
--    source must be deliberately turned on by an admin after a human has
--    verified its URL and robots.txt — it can never go live "by accident"
--    just because a row was inserted without specifying the column.
-- ---------------------------------------------------------------------------
create table sources (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  authority         text not null,
  url               text not null,
  category          text,
  source_type       source_type not null default 'OTHER',
  priority          smallint not null default 3,
  update_frequency  text,
  is_active         boolean not null default false,   -- SECURITY FIX: was true
  robots_txt_checked_at timestamptz,
  allowed_by_robots boolean,
  last_checked_at   timestamptz,
  last_hash         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_sources_active on sources (is_active);

-- ---------------------------------------------------------------------------
-- 3. users — application profile, one row per Supabase Auth user.
--    SECURITY FIX (review item 6): id now REFERENCES auth.users(id) instead
--    of generating its own independent uuid, so a public.users row can
--    never exist detached from a real authenticated identity, and the
--    linkage can't drift. A trigger on auth.users (below, after this table
--    and roles/audit_logs exist) auto-creates the profile row on signup so
--    editors never have to be inserted by hand with a guessed id.
-- ---------------------------------------------------------------------------
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  email         text unique not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. roles — role assignment per user (a user may hold more than one role)
-- ---------------------------------------------------------------------------
create table roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users(id) on delete cascade,
  role       user_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references users(id),
  unique (user_id, role)
);

-- ---------------------------------------------------------------------------
-- 5. locations
-- ---------------------------------------------------------------------------
create table locations (
  id        uuid primary key default uuid_generate_v4(),
  name_en   text not null,
  name_mr   text,
  district  text,
  taluka    text,
  lat       numeric(9,6),
  lng       numeric(9,6)
);

-- ---------------------------------------------------------------------------
-- 6. stations
-- ---------------------------------------------------------------------------
create table stations (
  id           uuid primary key default uuid_generate_v4(),
  name_en      text not null,
  name_mr      text,
  code         text,
  location_id  uuid references locations(id),
  zone         text,
  division     text,
  is_demo      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. projects — top-level project registry.
--    NOTE on review item 5: this table itself stays "shell + current
--    snapshot" as designed. The public-safety fix is NOT here — it's a
--    dedicated public.projects_public VIEW defined at the bottom of this
--    file, plus the matching RLS policy change in rls_policies.sql that
--    stops anon/authenticated from reading this base table directly.
-- ---------------------------------------------------------------------------
create table projects (
  id            text primary key,
  name_en       text not null,
  name_mr       text,
  district      text,
  zone          text,
  division      text,
  category      project_category not null,
  length_km     numeric(6,2),
  status        project_status not null,
  cost_crore    numeric(10,2),
  summary_en    text,
  summary_mr    text,
  featured      boolean not null default false,
  is_demo       boolean not null default true,
  verification  verification_status not null default 'NEW',
  location_id   uuid references locations(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_projects_status on projects (status);
create index idx_projects_category on projects (category);
create index idx_projects_featured on projects (featured);

-- ---------------------------------------------------------------------------
-- 8. project_versions — append-only history of every change to a project's
--    tracked fields ("WHAT CHANGED?"). Never update or delete rows here.
--    SECURITY FIX (review items 2/3): visibility is handled entirely in
--    rls_policies.sql — public may only ever see verification IN
--    ('VERIFIED','ARCHIVED'); a freshly inserted NEW/PENDING_REVIEW row is
--    invisible to anon/authenticated until a verifier promotes it.
-- ---------------------------------------------------------------------------
create table project_versions (
  id             uuid primary key default uuid_generate_v4(),
  project_id     text not null references projects(id) on delete cascade,
  field_name     text not null,
  old_value      text,
  new_value      text,
  changed_at     timestamptz not null default now(),
  source_id      uuid references sources(id),
  recorded_by    uuid references users(id),
  verification   verification_status not null default 'PENDING_REVIEW'
);
create index idx_project_versions_project on project_versions (project_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 9. project_updates — short-form "latest updates" feed items.
--    created_by is now set automatically by trigger (see set_created_by
--    below), never trusted from client input — this is what makes the
--    "editor can't verify their own submission" policy in
--    rls_policies.sql actually trustworthy (review item 9).
-- ---------------------------------------------------------------------------
create table project_updates (
  id            uuid primary key default uuid_generate_v4(),
  project_id    text references projects(id) on delete cascade,
  headline_en   text not null,
  headline_mr   text,
  body_en       text,
  body_mr       text,
  source_id     uuid references sources(id),
  is_demo       boolean not null default true,
  verification  verification_status not null default 'NEW',
  created_by    uuid references users(id),
  event_date    date not null,
  created_at    timestamptz not null default now()
);
create index idx_project_updates_project on project_updates (project_id, event_date desc);

-- ---------------------------------------------------------------------------
-- 10. timeline_events
-- ---------------------------------------------------------------------------
create table timeline_events (
  id            uuid primary key default uuid_generate_v4(),
  project_id    text references projects(id) on delete set null,
  title_en      text not null,
  title_mr      text,
  description_en text,
  description_mr text,
  event_date    date not null,
  source_id     uuid references sources(id),
  verification  verification_status not null default 'NEW',
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);
create index idx_timeline_events_date on timeline_events (event_date);

-- ---------------------------------------------------------------------------
-- 11. documents
-- ---------------------------------------------------------------------------
create table documents (
  id              uuid primary key default uuid_generate_v4(),
  project_id      text references projects(id) on delete set null,
  title           text not null,
  doc_type        text not null,
  authority       text,
  reference_number text,
  document_date   date,
  file_url        text,
  source_id       uuid references sources(id),
  verification    verification_status not null default 'NEW',
  uploaded_by     uuid references users(id),
  created_at      timestamptz not null default now()
);
create index idx_documents_project on documents (project_id);

-- ---------------------------------------------------------------------------
-- 12. rtis
-- ---------------------------------------------------------------------------
create table rtis (
  id                uuid primary key default uuid_generate_v4(),
  project_id        text references projects(id) on delete set null,
  application_date  date,
  application_number text,
  authority         text,
  subject           text not null,
  reply_date        date,
  reply_number      text,
  key_information_en text,
  key_information_mr text,
  document_id       uuid references documents(id),
  source_id         uuid references sources(id),
  verification      verification_status not null default 'NEW',
  created_by        uuid references users(id),
  created_at        timestamptz not null default now()
);
create index idx_rtis_project on rtis (project_id);

-- ---------------------------------------------------------------------------
-- 13. railway_services
-- ---------------------------------------------------------------------------
create table railway_services (
  id              uuid primary key default uuid_generate_v4(),
  project_id      text references projects(id) on delete set null,
  station_id      uuid references stations(id),
  change_type     service_change_type not null,
  train_name      text,
  train_number    text,
  description_en  text not null,
  description_mr  text,
  effective_date  date,
  source_id       uuid references sources(id),
  verification    verification_status not null default 'NEW',
  created_by      uuid references users(id),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 14. news_updates
-- ---------------------------------------------------------------------------
create table news_updates (
  id            uuid primary key default uuid_generate_v4(),
  project_id    text references projects(id) on delete set null,
  headline_en   text not null,
  headline_mr   text,
  publication   text,
  article_url   text,
  published_at  date,
  source_id     uuid references sources(id),
  verification  verification_status not null default 'NEW',
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 15. verification_records — the audit trail of who verified what.
--     record_type/record_id is a lightweight polymorphic reference — the
--     application layer, not Postgres FKs, enforces record_type is one of
--     the known table names. Insert-only for VERIFIER/SUPER_ADMIN; no
--     UPDATE/DELETE policy is defined for anyone in rls_policies.sql, so
--     this table is append-only by omission, same pattern as audit_logs.
-- ---------------------------------------------------------------------------
create table verification_records (
  id            uuid primary key default uuid_generate_v4(),
  record_type   text not null,
  record_id     uuid not null,
  previous_status verification_status,
  new_status    verification_status not null,
  reviewed_by   uuid references users(id),
  notes         text,
  reviewed_at   timestamptz not null default now()
);
create index idx_verification_records_target on verification_records (record_type, record_id);

-- ---------------------------------------------------------------------------
-- 16. audit_logs — append-only. Populated ONLY by the write_audit_log()
--     trigger below (SECURITY DEFINER). SECURITY FIX (review item 8): no
--     RLS policy grants direct client INSERT any more — see
--     rls_policies.sql. That is what actually stops a client (including a
--     SUPER_ADMIN using the anon/authenticated API key) from forging or
--     padding audit history; the trigger writes as the function owner,
--     which is a separate, higher trust boundary than any application role.
-- ---------------------------------------------------------------------------
create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references users(id),
  action      text not null,
  table_name  text,
  record_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_logs_created on audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- 17. visitor_statistics
-- ---------------------------------------------------------------------------
create table visitor_statistics (
  id           uuid primary key default uuid_generate_v4(),
  stat_date    date not null,
  page_path    text not null,
  view_count   integer not null default 0,
  unique_ct    integer not null default 0,
  unique (stat_date, page_path)
);
create index idx_visitor_statistics_date on visitor_statistics (stat_date desc);

-- ============================================================================
-- Generic updated_at trigger
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create trigger trg_sources_updated_at before update on sources
  for each row execute function set_updated_at();
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();

-- ============================================================================
-- SECURITY FIX (review item 6) — auto-provision public.users on signup.
-- Runs as SECURITY DEFINER so it can write to public.users regardless of
-- the new auth user's own (nonexistent-yet) permissions. search_path is
-- pinned to prevent search-path hijacking (review item 7).
-- ============================================================================
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ============================================================================
-- SECURITY FIX (review item 9) — created_by is ALWAYS set by trigger from
-- the caller's own auth.uid(), never trusted from client-submitted JSON.
-- This is what makes "a verifier can't approve their own submission"
-- enforceable — the created_by value can't be spoofed to dodge the check.
-- Applied to every content table an EDITOR can insert into.
-- ============================================================================
create or replace function set_created_by()
returns trigger as $$
begin
  new.created_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_set_created_by_project_updates
  before insert on project_updates
  for each row execute function set_created_by();
create trigger trg_set_created_by_timeline_events
  before insert on timeline_events
  for each row execute function set_created_by();
create trigger trg_set_created_by_rtis
  before insert on rtis
  for each row execute function set_created_by();
create trigger trg_set_created_by_railway_services
  before insert on railway_services
  for each row execute function set_created_by();
create trigger trg_set_created_by_news_updates
  before insert on news_updates
  for each row execute function set_created_by();

create or replace function set_uploaded_by()
returns trigger as $$
begin
  new.uploaded_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_set_uploaded_by_documents
  before insert on documents
  for each row execute function set_uploaded_by();

-- ============================================================================
-- SECURITY FIX (review item 4) — the collector's own hard ceiling.
-- The service-role key used by automation/collector.js bypasses Row Level
-- Security by design (that's what a service key IS in Supabase). RLS
-- policies therefore CANNOT constrain it — only a trigger can, because
-- triggers fire regardless of RLS bypass. This trigger is the actual
-- enforcement point for "the collector can never create or promote
-- content to VERIFIED or ARCHIVED": it rejects any insert from a
-- service_role connection whose verification isn't NEW/PENDING_REVIEW,
-- and rejects any update from a service_role connection that changes
-- verification at all (the collector should never be doing verification
-- updates in the first place — this makes that a hard database rule, not
-- just an assumption about what collector.js happens to do today).
-- ============================================================================
create or replace function guard_collector_verification()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    if TG_OP = 'INSERT' then
      if new.verification not in ('NEW', 'PENDING_REVIEW') then
        raise exception
          'collector (service_role) may only insert NEW or PENDING_REVIEW rows, got %',
          new.verification;
      end if;
    elsif TG_OP = 'UPDATE' then
      if new.verification is distinct from old.verification then
        raise exception
          'collector (service_role) is not permitted to change verification status — that requires a VERIFIER acting through the reviewed app, not the automated collector';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_guard_collector_project_versions
  before insert or update on project_versions
  for each row execute function guard_collector_verification();
create trigger trg_guard_collector_project_updates
  before insert or update on project_updates
  for each row execute function guard_collector_verification();
create trigger trg_guard_collector_timeline_events
  before insert or update on timeline_events
  for each row execute function guard_collector_verification();
create trigger trg_guard_collector_documents
  before insert or update on documents
  for each row execute function guard_collector_verification();
create trigger trg_guard_collector_rtis
  before insert or update on rtis
  for each row execute function guard_collector_verification();
create trigger trg_guard_collector_railway_services
  before insert or update on railway_services
  for each row execute function guard_collector_verification();
create trigger trg_guard_collector_news_updates
  before insert or update on news_updates
  for each row execute function guard_collector_verification();

-- ============================================================================
-- Audit trigger — logs INSERT/UPDATE/DELETE on the public content tables.
-- Uses auth.uid() (Supabase's own helper) rather than reading the JWT claim
-- by hand, and is pinned with search_path for review item 7.
-- ============================================================================
create or replace function write_audit_log()
returns trigger as $$
begin
  insert into audit_logs (actor_id, action, table_name, record_id, detail)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    to_jsonb(coalesce(new, old))
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger trg_audit_projects
  after insert or update or delete on projects
  for each row execute function write_audit_log();
create trigger trg_audit_project_updates
  after insert or update or delete on project_updates
  for each row execute function write_audit_log();
create trigger trg_audit_documents
  after insert or update or delete on documents
  for each row execute function write_audit_log();
create trigger trg_audit_rtis
  after insert or update or delete on rtis
  for each row execute function write_audit_log();

-- ============================================================================
-- SECURITY FIX (review item 5) — public-safe view of `projects`.
-- The base table keeps the raw current snapshot (status/cost/summary) as a
-- single row per project, which is the simplest shape for editors and
-- verifiers to work with. But that means an un-verified project's raw
-- status/cost/summary would otherwise leak to anon readers through a
-- naive "using (true)" policy. This view is the one anon/authenticated are
-- actually granted SELECT on (see rls_policies.sql): the shell fields
-- (name, district, category, etc.) are always shown, but status/cost/
-- summary are only shown once verification is VERIFIED/ARCHIVED, or the
-- record is explicitly is_demo — matching the "no fake data, no unverified
-- facts presented as fact" requirement from the original brief.
-- This view intentionally does NOT use security_invoker: it runs with the
-- view owner's privileges (the table owner, e.g. the Supabase project's
-- `postgres` role), so it can read every row of `projects` regardless of
-- the querying role's own RLS access — that is what lets it work as the
-- single safe gate once the base table's own SELECT policy is restricted
-- to staff roles only (see rls_policies.sql). If this view were declared
-- security_invoker instead, it would inherit the caller's own (denied)
-- access to the base table and silently return zero rows to the public.
-- ============================================================================
create view projects_public as
select
  id, name_en, name_mr, district, zone, division, category, length_km,
  featured, is_demo, location_id, created_at,
  case when verification in ('VERIFIED','ARCHIVED') or is_demo then status end as status,
  case when verification in ('VERIFIED','ARCHIVED') or is_demo then cost_crore end as cost_crore,
  case when verification in ('VERIFIED','ARCHIVED') or is_demo then summary_en end as summary_en,
  case when verification in ('VERIFIED','ARCHIVED') or is_demo then summary_mr end as summary_mr,
  updated_at
from projects;

grant select on projects_public to anon, authenticated;
