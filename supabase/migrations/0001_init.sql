-- TeamFit MVP schema (idempotent). ใช้ได้ทั้ง Supabase Postgres และ Postgres ท้องถิ่น
-- หมายเหตุ: บน Supabase ฟังก์ชัน auth.uid() มีอยู่แล้ว; บน Postgres ท้องถิ่นจะสร้าง shim ให้

create extension if not exists pgcrypto;

-- บน Supabase role เหล่านี้มีอยู่แล้ว; บน Postgres ท้องถิ่นสร้างให้เพื่อให้ policy อ้างถึงได้
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid() returns uuid language sql stable as $f$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $f$;
  end if;
end $$;

-- ---------- enums ----------
do $$ begin
  create type membership_role as enum ('org_admin', 'recruiter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type role_status as enum ('draft', 'discovery', 'profile_review', 'open', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discovery_sender as enum ('ai', 'recruiter', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type profile_version_status as enum ('proposed', 'confirmed', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_kind as enum ('shared', 'personal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_audience as enum ('candidate', 'organization');
exception when duplicate_object then null; end $$;

-- ---------- core ----------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  data_retention_days integer not null default 365 check (data_retention_days between 30 and 3650),
  is_demo boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- users.id = auth.users.id เมื่อใช้ Supabase Auth
create table if not exists users (
  id uuid primary key,
  email text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role membership_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists memberships_user_idx on memberships(user_id);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  level text not null default '',
  status role_status not null default 'draft',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roles_org_idx on roles(org_id, created_at desc);

create table if not exists role_discovery_messages (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id) on delete cascade,
  seq integer not null,
  sender discovery_sender not null,
  content text not null,
  options jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (role_id, seq)
);

create table if not exists role_profile_versions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id) on delete cascade,
  version integer not null,
  status profile_version_status not null default 'proposed',
  profile jsonb not null,
  methodology_version text not null,
  source text not null default 'ai', -- ai | demo | manual
  confirmed_by uuid references users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (role_id, version)
);

-- ---------- assessment ----------
create table if not exists assessment_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  scoring_version text not null,
  item_count integer not null,
  items_per_page integer not null default 8,
  created_at timestamptz not null default now()
);

create table if not exists assessment_items (
  id text not null,
  assessment_version_id uuid not null references assessment_versions(id) on delete cascade,
  scale text not null,
  position integer not null,
  text text not null,
  reverse_scored boolean not null default false,
  context text not null default '',
  rationale text not null default '',
  pair_group text,
  version integer not null default 1,
  primary key (assessment_version_id, id)
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  role_profile_version_id uuid not null references role_profile_versions(id),
  assessment_version_id uuid not null references assessment_versions(id),
  kind invitation_kind not null,
  token_hash text not null unique,
  label text not null default '',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invitations_role_idx on invitations(role_id);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  candidate_code text not null,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  unique (role_id, candidate_code)
);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  user_agent text,
  ip_hash text
);

create table if not exists assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  invitation_id uuid not null references invitations(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  role_profile_version_id uuid not null references role_profile_versions(id),
  assessment_version_id uuid not null references assessment_versions(id),
  session_token_hash text not null unique,
  status session_status not null default 'not_started',
  consent_record_id uuid references consent_records(id),
  current_page integer not null default 0,
  started_at timestamptz,
  submitted_at timestamptz,
  last_saved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sessions_role_idx on assessment_sessions(role_id, created_at);
create index if not exists sessions_invitation_idx on assessment_sessions(invitation_id);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references assessment_sessions(id) on delete cascade,
  item_id text not null,
  value smallint not null check (value between 1 and 5),
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, item_id)
);

create table if not exists score_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references assessment_sessions(id) on delete cascade,
  scoring_version text not null,
  assessment_version_code text not null,
  role_profile_version_id uuid not null references role_profile_versions(id),
  scale_scores jsonb not null,
  alignment jsonb not null,
  response_quality jsonb not null,
  computed_at timestamptz not null default now()
);

create table if not exists ai_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references assessment_sessions(id) on delete cascade,
  audience report_audience not null,
  provider text not null, -- claude | demo
  model text not null default '',
  status text not null default 'ready', -- ready | failed
  content jsonb not null,
  score_report_id uuid references score_reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, audience)
);

create table if not exists recruiter_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  session_id uuid not null references assessment_sessions(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  session_id uuid references assessment_sessions(id) on delete set null,
  requested_by text not null, -- candidate | organization
  reason text not null default '',
  status text not null default 'pending', -- pending | done
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists audit_events (
  id bigserial primary key,
  org_id uuid references organizations(id) on delete cascade,
  actor_type text not null, -- user | candidate | system
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_org_idx on audit_events(org_id, created_at desc);

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- ---------- helper: สมาชิกขององค์กร (ใช้ใน RLS) ----------
create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m where m.org_id = p_org and m.user_id = auth.uid() and m.role = 'org_admin'
  );
$$;

-- ---------- Row Level Security ----------
-- หลักการ: ผู้ใช้ที่ล็อกอิน (authenticated) เห็นเฉพาะข้อมูลขององค์กรที่ตนเป็นสมาชิก
-- ฝั่งผู้สมัครไม่มี policy สำหรับ anon เลย: ทุกอย่างผ่าน server ที่ตรวจ token เอง
-- ตาราง rate_limits / audit_events ไม่เปิดให้ client เขียน

alter table organizations enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table roles enable row level security;
alter table role_discovery_messages enable row level security;
alter table role_profile_versions enable row level security;
alter table assessment_versions enable row level security;
alter table assessment_items enable row level security;
alter table invitations enable row level security;
alter table candidates enable row level security;
alter table consent_records enable row level security;
alter table assessment_sessions enable row level security;
alter table responses enable row level security;
alter table score_reports enable row level security;
alter table ai_reports enable row level security;
alter table recruiter_notes enable row level security;
alter table deletion_requests enable row level security;
alter table audit_events enable row level security;
alter table rate_limits enable row level security;

drop policy if exists org_member_select on organizations;
create policy org_member_select on organizations for select using (is_org_member(id));
drop policy if exists org_admin_update on organizations;
create policy org_admin_update on organizations for update using (is_org_admin(id));

drop policy if exists users_self on users;
create policy users_self on users for select using (id = auth.uid());

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships for select using (is_org_member(org_id));

drop policy if exists roles_member on roles;
create policy roles_member on roles for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists discovery_member on role_discovery_messages;
create policy discovery_member on role_discovery_messages for all
  using (exists (select 1 from roles r where r.id = role_id and is_org_member(r.org_id)))
  with check (exists (select 1 from roles r where r.id = role_id and is_org_member(r.org_id)));

drop policy if exists profile_versions_member on role_profile_versions;
create policy profile_versions_member on role_profile_versions for all
  using (exists (select 1 from roles r where r.id = role_id and is_org_member(r.org_id)))
  with check (exists (select 1 from roles r where r.id = role_id and is_org_member(r.org_id)));

drop policy if exists assessment_versions_read on assessment_versions;
create policy assessment_versions_read on assessment_versions for select to authenticated using (true);

-- ข้อคำถาม + scoring key: องค์กรที่ล็อกอินอ่านได้ (เพื่อดูเอกสารสูตร) แต่ anon อ่านไม่ได้
drop policy if exists assessment_items_read on assessment_items;
create policy assessment_items_read on assessment_items for select to authenticated using (true);

drop policy if exists invitations_member on invitations;
create policy invitations_member on invitations for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists candidates_member on candidates;
create policy candidates_member on candidates for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists consent_member on consent_records;
create policy consent_member on consent_records for select using (is_org_member(org_id));

drop policy if exists sessions_member on assessment_sessions;
create policy sessions_member on assessment_sessions for select using (is_org_member(org_id));

drop policy if exists responses_member on responses;
create policy responses_member on responses for select
  using (exists (select 1 from assessment_sessions s where s.id = session_id and is_org_member(s.org_id)));

drop policy if exists score_reports_member on score_reports;
create policy score_reports_member on score_reports for select
  using (exists (select 1 from assessment_sessions s where s.id = session_id and is_org_member(s.org_id)));

drop policy if exists ai_reports_member on ai_reports;
create policy ai_reports_member on ai_reports for select
  using (exists (select 1 from assessment_sessions s where s.id = session_id and is_org_member(s.org_id)));

drop policy if exists notes_member on recruiter_notes;
create policy notes_member on recruiter_notes for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists deletion_member on deletion_requests;
create policy deletion_member on deletion_requests for select using (is_org_member(org_id));

drop policy if exists audit_member on audit_events;
create policy audit_member on audit_events for select using (org_id is not null and is_org_admin(org_id));

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists roles_set_updated_at on roles;
create trigger roles_set_updated_at before update on roles for each row execute function public.set_updated_at();
