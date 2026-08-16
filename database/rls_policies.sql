-- ============================================================================
-- ROW-LEVEL SECURITY (security-hardened) — run after schema.sql
-- Model: Supabase Auth. auth.uid() returns the logged-in user's id, which
-- now always equals users.id (users.id REFERENCES auth.users(id) — see
-- schema.sql review item 6).
-- ============================================================================

alter table sources enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table locations enable row level security;
alter table stations enable row level security;
alter table projects enable row level security;
alter table project_versions enable row level security;
alter table project_updates enable row level security;
alter table timeline_events enable row level security;
alter table documents enable row level security;
alter table rtis enable row level security;
alter table railway_services enable row level security;
alter table news_updates enable row level security;
alter table verification_records enable row level security;
alter table audit_logs enable row level security;
alter table visitor_statistics enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: does the current user hold role X?
-- SECURITY FIX (review item 7): search_path is explicitly pinned on every
-- SECURITY DEFINER function so a malicious search_path set by the calling
-- session cannot redirect these functions to a same-named object in
-- another schema (the classic search_path-hijack privilege escalation).
-- ---------------------------------------------------------------------------
create or replace function has_role(target_role user_role)
returns boolean as $$
  select exists (
    select 1 from roles
    where user_id = auth.uid() and role = target_role
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function is_editor_or_above()
returns boolean as $$
  select has_role('SUPER_ADMIN') or has_role('EDITOR');
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function is_verifier_or_above()
returns boolean as $$
  select has_role('SUPER_ADMIN') or has_role('VERIFIER');
$$ language sql security definer stable set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- PUBLIC (anon) READ POLICIES
-- ---------------------------------------------------------------------------

-- SECURITY FIX (review item 5): `projects` base table is NO LONGER
-- publicly readable directly (the old `using (true)` policy is removed).
-- Public reads now go through the `projects_public` VIEW defined at the
-- end of schema.sql, which only exposes status/cost/summary once a
-- project's own verification is VERIFIED/ARCHIVED (or it's demo data).
-- Only staff roles may read the raw table (which carries unverified
-- current-snapshot fields).
create policy staff_read_projects on projects
  for select using (is_editor_or_above() or is_verifier_or_above());

-- SECURITY FIX (review items 2 & 3): project_versions is split into a
-- public policy (VERIFIED/ARCHIVED only — a freshly inserted NEW or
-- PENDING_REVIEW version row is invisible to anon/authenticated) and a
-- staff policy (editors/verifiers need to see PENDING_REVIEW items to do
-- their job). Postgres OR-combines multiple permissive SELECT policies
-- on the same table, so a public user matches only the first policy and
-- a staff user matches either — both end up correct.
create policy public_read_verified_project_versions on project_versions
  for select using (verification in ('VERIFIED','ARCHIVED'));

create policy staff_read_all_project_versions on project_versions
  for select using (is_editor_or_above() or is_verifier_or_above());

create policy public_read_project_updates on project_updates
  for select using (verification in ('VERIFIED','ARCHIVED') or is_demo = true);

create policy public_read_timeline_events on timeline_events
  for select using (verification in ('VERIFIED','ARCHIVED'));

create policy public_read_documents on documents
  for select using (verification in ('VERIFIED','ARCHIVED'));

create policy public_read_rtis on rtis
  for select using (verification in ('VERIFIED','ARCHIVED'));

create policy public_read_railway_services on railway_services
  for select using (verification in ('VERIFIED','ARCHIVED'));

create policy public_read_news_updates on news_updates
  for select using (verification in ('VERIFIED','ARCHIVED'));

create policy public_read_sources on sources
  for select using (is_active = true);

create policy public_read_stations on stations for select using (true);
create policy public_read_locations on locations for select using (true);

-- visitor_statistics: no public SELECT policy — aggregate totals should be
-- served through a dedicated read endpoint/view, not the raw table.

-- ---------------------------------------------------------------------------
-- EDITOR write policies — can INSERT content, always landing at NEW or
-- PENDING_REVIEW (never directly VERIFIED). created_by/uploaded_by are set
-- by trigger (schema.sql), not trusted from the request body, which is
-- what makes the "no self-approval" verifier policies below meaningful —
-- an editor cannot spoof someone else's name onto their own submission.
-- ---------------------------------------------------------------------------
create policy editor_write_project_updates on project_updates
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));
create policy editor_update_own_project_updates on project_updates
  for update using (is_editor_or_above() and created_by = auth.uid())
  with check (verification in ('NEW','PENDING_REVIEW'));

create policy editor_write_documents on documents
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));

create policy editor_write_rtis on rtis
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));

create policy editor_write_timeline_events on timeline_events
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));

create policy editor_write_railway_services on railway_services
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));

create policy editor_write_news_updates on news_updates
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));

-- ---------------------------------------------------------------------------
-- VERIFIER policies — the only role allowed to move a row's verification
-- to VERIFIED/REJECTED/ARCHIVED.
-- SECURITY FIX (review item 9): every verifier UPDATE policy now excludes
-- rows the same person authored (`created_by is distinct from auth.uid()`
-- / `uploaded_by is distinct from auth.uid()`). A user who happens to hold
-- BOTH the EDITOR and VERIFIER roles can no longer approve their own
-- submission — someone else with the VERIFIER role has to do it. Note:
-- SUPER_ADMIN is intentionally NOT exempted from this check — even a
-- super-admin cannot self-approve their own content through this policy,
-- since is_verifier_or_above() covers SUPER_ADMIN too and the
-- self-authorship check applies regardless of which role qualified them.
-- The WITH CHECK also constrains which verification values a verifier may
-- set, so this policy can't be (ab)used to reset something back to NEW.
-- ---------------------------------------------------------------------------
create policy verifier_update_project_updates on project_updates
  for update using (is_verifier_or_above() and created_by is distinct from auth.uid())
  with check (verification in ('VERIFIED','REJECTED','PENDING_REVIEW','ARCHIVED'));

create policy verifier_update_documents on documents
  for update using (is_verifier_or_above() and uploaded_by is distinct from auth.uid())
  with check (verification in ('VERIFIED','REJECTED','PENDING_REVIEW','ARCHIVED'));

create policy verifier_update_rtis on rtis
  for update using (is_verifier_or_above() and created_by is distinct from auth.uid())
  with check (verification in ('VERIFIED','REJECTED','PENDING_REVIEW','ARCHIVED'));

create policy verifier_update_timeline_events on timeline_events
  for update using (is_verifier_or_above() and created_by is distinct from auth.uid())
  with check (verification in ('VERIFIED','REJECTED','PENDING_REVIEW','ARCHIVED'));

create policy verifier_update_railway_services on railway_services
  for update using (is_verifier_or_above() and created_by is distinct from auth.uid())
  with check (verification in ('VERIFIED','REJECTED','PENDING_REVIEW','ARCHIVED'));

create policy verifier_update_news_updates on news_updates
  for update using (is_verifier_or_above() and created_by is distinct from auth.uid())
  with check (verification in ('VERIFIED','REJECTED','PENDING_REVIEW','ARCHIVED'));

create policy verifier_insert_verification_records on verification_records
  for insert with check (is_verifier_or_above());

create policy verifier_read_verification_records on verification_records
  for select using (is_verifier_or_above());

-- verification_records has no UPDATE/DELETE policy for any role — a
-- verification decision, once logged, is permanent, same append-only
-- pattern as audit_logs and project_versions.

-- ---------------------------------------------------------------------------
-- project_versions: append-only. No UPDATE/DELETE policy exists for ANY
-- role (including SUPER_ADMIN) — absence of a policy denies the action by
-- default under RLS. Only editors/verifiers may INSERT, and only at
-- NEW/PENDING_REVIEW (the collector's own ceiling is enforced separately
-- by the guard_collector_verification trigger in schema.sql, since the
-- service-role key bypasses RLS entirely and these policies don't apply
-- to it at all).
-- ---------------------------------------------------------------------------
create policy insert_project_versions on project_versions
  for insert with check (is_editor_or_above() and verification in ('NEW','PENDING_REVIEW'));

-- ---------------------------------------------------------------------------
-- audit_logs — SECURITY FIX (review item 8): there is NO insert policy
-- here at all any more. The old `for insert with check (true)` policy is
-- removed because it let any authenticated/anon client write directly to
-- audit_logs via the REST API — completely bypassing the trigger and
-- letting someone forge or pad audit history. Rows are written exclusively
-- by the write_audit_log() SECURITY DEFINER trigger in schema.sql, which
-- runs as the function owner (a higher, separate trust boundary than any
-- application role, including SUPER_ADMIN) and is therefore unaffected by
-- RLS regardless of policies here. With no INSERT/UPDATE/DELETE policy
-- present for any application role, audit_logs is genuinely append-only
-- and tamper-resistant from every app-level role, including SUPER_ADMIN —
-- a SUPER_ADMIN using the anon/authenticated API key can read it
-- (see below) but cannot write, edit, or delete a single row.
-- ---------------------------------------------------------------------------
create policy read_audit_logs on audit_logs
  for select using (has_role('SUPER_ADMIN'));

-- ---------------------------------------------------------------------------
-- Admin-only tables
-- ---------------------------------------------------------------------------
create policy admin_manage_sources on sources
  for all using (has_role('SUPER_ADMIN')) with check (has_role('SUPER_ADMIN'));
-- Note: this still lets a SUPER_ADMIN flip sources.is_active to true
-- through the API — that is intended (someone has to be able to), but it
-- means "no real collector is activated" (review item 11) is currently
-- true only because no source row has is_active=true yet, not because the
-- database forbids it. Flipping this remains a deliberate, later, human step.

create policy admin_manage_roles on roles
  for all using (has_role('SUPER_ADMIN')) with check (has_role('SUPER_ADMIN'));

create policy self_read_users on users
  for select using (id = auth.uid() or has_role('SUPER_ADMIN'));

-- ---------------------------------------------------------------------------
-- Service-role key (used only by the GitHub Actions collector, stored only
-- in GitHub Actions Secrets, NEVER in the frontend) bypasses RLS entirely
-- by design in Supabase. RLS policies in this file therefore CANNOT be the
-- thing stopping the collector from writing VERIFIED/ARCHIVED content —
-- that enforcement lives in the guard_collector_verification() trigger in
-- schema.sql (review item 4), because triggers fire regardless of RLS
-- bypass. Keep both files in sync: if you add a new content table with a
-- `verification` column, it needs BOTH an editor/verifier RLS policy here
-- AND the guard_collector_verification trigger attached in schema.sql —
-- either alone is not sufficient.
-- ---------------------------------------------------------------------------
