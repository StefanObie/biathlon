-- Core tables. See biathlon-technical-spec.md §6.1-6.2.

-- Holds security definer helpers and trigger functions. Not in the API's
-- exposed schemas, so nothing here is callable as an RPC.
create schema private;

grant usage on schema private to authenticated;

create type gender as enum ('M', 'F');

-- Organizations (#10, #29). An Organization runs Leagues; its Members are
-- users, and the Admin flag lives on the membership rather than being a
-- per-League Role. Signing up creates an Organization (see
-- create_organization below); inviting Members comes in a later ticket.
create table organization (
  id integer primary key generated always as identity,
  name text not null check (name <> '')
);

alter table organization enable row level security;

create table organization_member (
  organization_id integer not null references organization (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  primary key (organization_id, user_id)
);

alter table organization_member enable row level security;

create index organization_member_user_idx on organization_member (user_id);

-- Athletes belong to an Organization (ADR 0002): two Organizations can use
-- the same Athlete number for different people.
create table athlete (
  organization_id integer not null references organization (id),
  athlete_no integer not null,
  full_name text not null,
  gender gender not null,
  primary key (organization_id, athlete_no)
);

alter table athlete enable row level security;

-- A League's Organization is fixed once it's created (see
-- league_organization_is_fixed below).
create table league (
  id integer primary key generated always as identity,
  name text not null,
  league_date date not null,
  season integer not null,
  organization_id integer not null references organization (id)
);

alter table league enable row level security;

create index league_organization_idx on league (organization_id);

create function private.league_organization_is_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A league''s organization cannot be changed';
  end if;
  return new;
end;
$$;

create trigger league_organization_is_fixed
  before update on league
  for each row execute function private.league_organization_is_fixed();

-- Rows that name an athlete (entry, position_capture, run_result,
-- swim_result) carry their League's Organization so they can reference the
-- athlete by (organization_id, athlete_no). The Organization is always taken
-- from the League, never from the writer: a phone syncing a capture doesn't
-- know its Organization, and a mismatched one would point at another
-- Organization's athlete. The column's default of 0 is never stored, it only
-- lets writers leave the column out. security definer so the League is
-- found even when RLS hides it, leaving RLS to refuse the write itself.
create function private.set_organization_from_league()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id
  from public.league
  where id = new.league_id;
  return new;
end;
$$;

-- League teams (#32). A Member has no access to a League unless they're on
-- its team or are an Admin of its Organization. Each row is one Role held
-- by one Member; a Member holding several Roles has several rows. Removing
-- a Role ends its row (ended_at) rather than deleting it, so the team's
-- history is kept, and a row once ended stays ended: giving the Role back
-- adds a new row. Admin isn't a team Role — it's organization_member.is_admin.
create type league_role as enum ('official', 'timekeeper', 'placer', 'caller');

-- organization_id is copied from the League by set_organization_from_league
-- (below), so the foreign key to organization_member only lets the League's
-- own Organization's Members on its team.
create table league_team_member (
  id integer primary key generated always as identity,
  league_id integer not null references league (id),
  organization_id integer not null default 0,
  user_id uuid not null,
  role league_role not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at),
  foreign key (organization_id, user_id) references organization_member (organization_id, user_id)
);

alter table league_team_member enable row level security;

-- One current entry per (League, Member, Role); ended ones pile up freely.
create unique index league_team_member_current_idx
  on league_team_member (league_id, user_id, role)
  where ended_at is null;

create index league_team_member_user_idx on league_team_member (user_id);

create index league_team_member_member_idx
  on league_team_member (organization_id, user_id);

-- Times on a team entry are when the database recorded them, whatever the
-- writer sent, so an entry can't be backdated or start already ended, and
-- once written it can only be ended.
create function private.league_team_member_keeps_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
    new.ended_at := null;
    return new;
  end if;

  if old.ended_at is not null
    or new.league_id is distinct from old.league_id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.started_at is distinct from old.started_at
  then
    raise exception 'A league team entry can only be ended';
  end if;
  if new.ended_at is not null then
    new.ended_at := now();
  end if;
  return new;
end;
$$;

create trigger league_team_member_keeps_history
  before insert or update on league_team_member
  for each row execute function private.league_team_member_keeps_history();

create trigger league_team_member_set_organization
  before insert or update on league_team_member
  for each row execute function private.set_organization_from_league();

-- Access helpers: the one place access is decided, used by every policy.
-- security definer so they can read organization_member and
-- league_team_member without tripping their own RLS; they live in
-- `private`, which the API doesn't expose, so they can't be called as RPCs
-- to probe other users' memberships.

-- The Role hierarchy below Admin: Official covers Timekeeper, Placer and
-- Caller.
-- A null `required` means any Role at all. (Admin covering Official is
-- resolved by the helpers below, since it isn't a team Role.)
create function private.role_covers(held league_role, required league_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select required is null or held = required or held = 'official';
$$;

-- Whether the current user is a Member of the Organization, or with
-- as_admin, an Admin of it.
create function private.is_org_member(org_id integer, as_admin boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_member
    where organization_id = org_id
      and user_id = (select auth.uid())
      and (is_admin or not as_admin)
  );
$$;

-- Whether the current user holds at least min_role on the League: an
-- Admin of its Organization, or on its team with a Role that covers
-- min_role. With no min_role, whether they hold any Role there, which is
-- what it takes to read the League at all. False for a League that
-- doesn't exist.
create function private.has_league_role(
  target_league_id integer,
  min_role league_role default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league l
    where l.id = target_league_id
      and (
        private.is_org_member(l.organization_id, as_admin => true)
        or exists (
          select 1 from public.league_team_member t
          where t.league_id = l.id
            and t.user_id = (select auth.uid())
            and t.ended_at is null
            and private.role_covers(t.role, min_role)
        )
      )
  );
$$;

-- Whether the current user holds at least min_role on any League of the
-- Organization (or is its Admin). Athletes belong to the Organization
-- rather than one League (ADR 0002), so this is what their rules use.
create function private.has_org_role(
  org_id integer,
  min_role league_role default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_member(org_id, as_admin => true)
    or exists (
      select 1 from public.league_team_member t
      where t.organization_id = org_id
        and t.user_id = (select auth.uid())
        and t.ended_at is null
        and private.role_covers(t.role, min_role)
    );
$$;

-- An Organization's Members with their emails, for its Admins to build
-- League teams from. Emails live in auth.users, which the API can't read,
-- so this is a security definer RPC that returns nothing to anyone but an
-- Admin of the Organization.
create function public.organization_members(org_id integer)
returns table (user_id uuid, email text, is_admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.is_admin
  from public.organization_member m
  join auth.users u on u.id = m.user_id
  where m.organization_id = org_id
    and private.is_org_member(org_id, as_admin => true)
  order by u.email;
$$;

revoke execute on function public.organization_members(integer) from public, anon;
grant execute on function public.organization_members(integer) to authenticated;

-- Signing up creates an Organization (#30): any signed-in user can create
-- one and becomes its only Admin. There are no insert policies on
-- organization or organization_member, so this security definer RPC is the
-- only way in, and it only ever adds the caller to the Organization it
-- just made.
create function public.create_organization(org_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to create an organization' using errcode = '42501';
  end if;
  if coalesce(trim(org_name), '') = '' then
    raise exception 'An organization needs a name' using errcode = '22023';
  end if;

  insert into public.organization (name)
  values (trim(org_name))
  returning id into new_id;

  insert into public.organization_member (organization_id, user_id, is_admin)
  values (new_id, (select auth.uid()), true);

  return new_id;
end;
$$;

revoke execute on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- age_group_code is intentionally not an FK to points_table: that table's key
-- includes effective_from/gender, which entry doesn't carry. Validated at
-- import time instead (see spec §6.1's trade-off note).
create table entry (
  league_id integer not null references league (id),
  organization_id integer not null default 0,
  athlete_no integer not null,
  run_heat integer not null,
  swim_heat integer not null,
  swim_lane integer not null,
  age_group_code text not null,
  primary key (league_id, athlete_no),
  foreign key (organization_id, athlete_no) references athlete (organization_id, athlete_no)
);

alter table entry enable row level security;

create trigger entry_set_organization
  before insert or update on entry
  for each row execute function private.set_organization_from_league();

create index entry_run_heat_idx on entry (league_id, run_heat);
create index entry_swim_heat_lane_idx on entry (league_id, swim_heat, swim_lane);

create table points_table (
  effective_from date not null,
  gender gender not null,
  age_group_code text not null,
  age_group_label text not null,
  sort_order integer not null,
  age_from integer not null,
  age_to integer not null,
  run_distance_m integer not null,
  run_base_time text not null,
  run_points_per_second numeric not null,
  swim_distance_m integer not null,
  swim_base_time text not null,
  swim_points_per_second numeric not null,
  -- Stored, not applied — see spec §6.3 (masters bonus deferred).
  bonus_points_per_year numeric not null,
  primary key (effective_from, gender, age_group_code)
);

alter table points_table enable row level security;

-- No public-facing reads yet (that's Phase 4, §3/§6.1): anon stays
-- default-deny via RLS-enabled-with-no-anon-policy. League-scoped tables
-- are readable by anyone holding a Role on the League, and writable by the
-- Roles that use them (private.has_league_role): Timekeepers the Timer
-- screen's tables, Placers the Position screen's, and Officials the rest.
-- The reference points table stays readable by any signed-in user.
-- Athletes belong to the Organization, so they follow Roles held on any of
-- its Leagues (private.has_org_role).

create policy "Team members can read their organizations' athletes"
  on athlete for select
  to authenticated
  using (private.has_org_role(organization_id));

create policy "Officials can add athletes"
  on athlete for insert
  to authenticated
  with check (private.has_org_role(organization_id, 'official'));

create policy "Officials can update athletes"
  on athlete for update
  to authenticated
  using (private.has_org_role(organization_id, 'official'))
  with check (private.has_org_role(organization_id, 'official'));

create policy "Officials can delete athletes"
  on athlete for delete
  to authenticated
  using (private.has_org_role(organization_id, 'official'));

create policy "Members can read their organizations"
  on organization for select
  to authenticated
  using (private.is_org_member(id));

create policy "Members can read their organizations' memberships"
  on organization_member for select
  to authenticated
  using (private.is_org_member(organization_id));

-- The Admin check reads the row's own organization_id rather than going
-- through has_league_role, which looks the League up and so can't see a
-- League inserted by the same statement: creating one and reading it back
-- (insert ... returning) would otherwise fail.
create policy "Team members can read their leagues"
  on league for select
  to authenticated
  using (
    private.is_org_member(organization_id, as_admin => true)
    or private.has_league_role(id)
  );

create policy "Admins can create leagues"
  on league for insert
  to authenticated
  with check (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can update leagues"
  on league for update
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true))
  with check (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can delete leagues"
  on league for delete
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

create policy "Team members can read their leagues' entries"
  on entry for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Officials can add entries"
  on entry for insert
  to authenticated
  with check (private.has_league_role(league_id, 'official'));

create policy "Officials can update entries"
  on entry for update
  to authenticated
  using (private.has_league_role(league_id, 'official'))
  with check (private.has_league_role(league_id, 'official'));

create policy "Officials can delete entries"
  on entry for delete
  to authenticated
  using (private.has_league_role(league_id, 'official'));

-- Admins manage every League team in their Organization. There's no
-- delete: removing a Role ends its entry (see league_team_member above).
create policy "Team members can read their leagues' teams"
  on league_team_member for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Admins can add to league teams"
  on league_team_member for insert
  to authenticated
  with check (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can end league team entries"
  on league_team_member for update
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true))
  with check (private.is_org_member(organization_id, as_admin => true));

revoke delete, truncate on league_team_member from anon, authenticated;

create policy "Authenticated users can read points table"
  on points_table for select
  to authenticated
  using (true);

-- Phase 1 capture and result tables. See spec §6.5-6.6.
--
-- A heat's identity is still the pair (league_id, run_heat), same as entry
-- (§6.2) — league_race (below) holds a heat's timer state, not a surrogate
-- id; position_capture/time_capture/run_result key on the pair directly
-- rather than a league_race FK.
--
-- position_capture/time_capture are immutable raw captures (§1): rows are
-- never UPDATE'd or DELETE'd after insert. Corrections are soft-voids
-- (voided/void_reason) or overlay rows in run_result, never edits to the
-- capture tables themselves.

create table position_capture (
  id text primary key,              -- ULID, client-generated (§5.8)
  league_id integer not null references league (id),
  run_heat integer not null,
  position integer not null,
  organization_id integer not null default 0,
  athlete_no integer, -- null = skip, no scan attempted
  device_id text not null,
  scanned_at timestamptz not null,
  voided boolean not null default false,
  void_reason text,
  foreign key (organization_id, athlete_no) references athlete (organization_id, athlete_no)
);

alter table position_capture enable row level security;

create trigger position_capture_set_organization
  before insert or update on position_capture
  for each row execute function private.set_organization_from_league();

create index position_capture_run_heat_idx
  on position_capture (league_id, run_heat);

create table time_capture (
  id text primary key,              -- ULID, client-generated (§5.8)
  league_id integer not null references league (id),
  run_heat integer not null,
  seq integer not null,
  elapsed_time text not null,       -- mm:SS.ss, see run_time format below
  is_placeholder boolean not null default false,
  device_id text not null,
  captured_at timestamptz not null,
  voided boolean not null default false,
  void_reason text
);

alter table time_capture enable row level security;

create index time_capture_run_heat_idx
  on time_capture (league_id, run_heat);

-- Heat-level timer start, kept separate from time_capture: this isn't a
-- finisher row, it's the clock anchor every elapsed_time in the heat is
-- measured against. One row per heat — upserted, not appended, so a second
-- operator (or the same operator after a refresh/dropped phone) reads the
-- same start instead of racing to create their own (§4.4 hand-off case).
--
-- It also holds whether the heat is closed (ADR 0001): saving a heat's
-- reconciliation sets closed_at/closed_by, and there is no separate publish
-- gate. Reopening clears both, and the reason goes to audit_log. The
-- capture screens never write these columns — their upserts of the timer
-- start leave an existing row alone — so a close can't be undone by a phone
-- syncing its start late.
create table league_race (
  league_id integer not null references league (id),
  run_heat integer not null,
  started_at timestamptz,
  device_id text,
  closed_at timestamptz,
  closed_by text,
  primary key (league_id, run_heat)
);

alter table league_race enable row level security;

-- Derived, overridable result (§6.5). Every mutation here is either
-- 'auto' (from reconciling captures) or 'manual' (an operator override),
-- and never touches position_capture/time_capture.
create table run_result (
  league_id integer not null references league (id),
  organization_id integer not null default 0,
  athlete_no integer not null,
  run_heat integer not null,
  run_time text check (run_time ~ '^\d{2}:\d{2}\.\d{2}$'),
  run_time_cs integer generated always as (
    case when run_time is null then null else
      substring(run_time from 1 for 2)::int * 6000
      + substring(run_time from 4 for 2)::int * 100
      + substring(run_time from 7 for 2)::int
    end
  ) stored,
  status text not null default 'ok', -- ok | dns | dnf | dq
  source text not null,              -- auto | manual
  overridden_by text,
  override_reason text,
  primary key (league_id, athlete_no, run_heat),
  foreign key (organization_id, athlete_no) references athlete (organization_id, athlete_no)
);

alter table run_result enable row level security;

create trigger run_result_set_organization
  before insert or update on run_result
  for each row execute function private.set_organization_from_league();

create index run_result_run_heat_idx
  on run_result (league_id, run_heat);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  league_id integer not null references league (id),
  at timestamptz not null default now(),
  actor text not null,
  entity text not null,
  action text not null,
  before jsonb,
  after jsonb,
  reason text
);

alter table audit_log enable row level security;

create index audit_log_league_idx on audit_log (league_id);

-- Captures are added and voided (the phones sync by upsert, so both insert
-- and update), never deleted.
create policy "Team members can read their leagues' position captures"
  on position_capture for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Placers can add position captures"
  on position_capture for insert
  to authenticated
  with check (private.has_league_role(league_id, 'placer'));

create policy "Placers can void position captures"
  on position_capture for update
  to authenticated
  using (private.has_league_role(league_id, 'placer'))
  with check (private.has_league_role(league_id, 'placer'));

create policy "Team members can read their leagues' time captures"
  on time_capture for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Timekeepers can add time captures"
  on time_capture for insert
  to authenticated
  with check (private.has_league_role(league_id, 'timekeeper'));

create policy "Timekeepers can void time captures"
  on time_capture for update
  to authenticated
  using (private.has_league_role(league_id, 'timekeeper'))
  with check (private.has_league_role(league_id, 'timekeeper'));

-- Officials do anything to a heat. A Timekeeper starts, fills in and
-- resets a heat's clock, but only while the heat is open, and can't set
-- closed_at/closed_by: for a Timekeeper both the row before and the row
-- after have to be open, so they can neither close nor reopen a heat.
create policy "Team members can read their leagues' heats"
  on league_race for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Timekeepers can start heats, and Officials close them"
  on league_race for insert
  to authenticated
  with check (
    private.has_league_role(league_id, 'official')
    or (
      private.has_league_role(league_id, 'timekeeper')
      and closed_at is null and closed_by is null
    )
  );

create policy "Timekeepers can fill in open heats, and Officials close and reopen them"
  on league_race for update
  to authenticated
  using (
    private.has_league_role(league_id, 'official')
    or (private.has_league_role(league_id, 'timekeeper') and closed_at is null)
  )
  with check (
    private.has_league_role(league_id, 'official')
    or (
      private.has_league_role(league_id, 'timekeeper')
      and closed_at is null and closed_by is null
    )
  );

create policy "Timekeepers can reset open heats, and Officials any heat"
  on league_race for delete
  to authenticated
  using (
    private.has_league_role(league_id, 'official')
    or (private.has_league_role(league_id, 'timekeeper') and closed_at is null)
  );

create policy "Officials can manage their leagues' run results"
  on run_result for all
  to authenticated
  using (private.has_league_role(league_id, 'official'))
  with check (private.has_league_role(league_id, 'official'));

-- League team changes are written to the audit log here, not by the app,
-- so no change can skip it. security definer to read the Member's email
-- from auth.users and to write audit_log whatever the writer's own Roles.
create function private.audit_league_team_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_entry jsonb := jsonb_build_object(
    'league_id', new.league_id,
    'user_id', new.user_id,
    'email', (select email from auth.users where id = new.user_id),
    'role', new.role
  );
  actor text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (league_id, actor, entity, action, after)
    values (new.league_id, actor, 'league_team', 'add-role', team_entry);
  elsif old.ended_at is null and new.ended_at is not null then
    insert into public.audit_log (league_id, actor, entity, action, before)
    values (new.league_id, actor, 'league_team', 'remove-role', team_entry);
  end if;
  return null;
end;
$$;

create trigger league_team_member_audit
  after insert or update on league_team_member
  for each row execute function private.audit_league_team_change();

-- Nothing edits or removes an audit row once it's written.
create policy "Officials can read their leagues' audit log"
  on audit_log for select
  to authenticated
  using (private.has_league_role(league_id, 'official'));

create policy "Officials can write their leagues' audit log"
  on audit_log for insert
  to authenticated
  with check (private.has_league_role(league_id, 'official'));

-- Phase 2 swim results (§4.6/§6.5). Unlike run_result, there is no capture
-- stream to reconcile: the Time Drops export arrives complete, is parsed
-- and reviewed client-side, and lands here in one confirmed write.
--
-- Key is (league_id, athlete_no) — biathlon is one run and one swim, so a
-- second event for the same athlete is a conflict an operator resolves at
-- import time, never a silent second row. event_no/heat/lane are retained
-- as source metadata (and for the (swim_heat, swim_lane) resolution key,
-- §2 Finding 3), not as identity.
create table swim_result (
  league_id integer not null references league (id),
  organization_id integer not null default 0,
  athlete_no integer not null,
  event_no integer not null,
  heat integer not null,
  lane integer not null,
  distance_m integer,
  swim_time text check (swim_time ~ '^\d{2}:\d{2}\.\d{2}$'),
  -- Generated, not client-supplied, for the same reason as run_time_cs:
  -- a hand-maintained duplicate of swim_time can drift out of sync with it.
  swim_time_cs integer generated always as (
    case when swim_time is null then null else
      substring(swim_time from 1 for 2)::int * 6000
      + substring(swim_time from 4 for 2)::int * 100
      + substring(swim_time from 7 for 2)::int
    end
  ) stored,
  -- Heat placing from the source file, null when the file recorded 0.
  -- Source metadata only: heats are not seeded by ability, so this is
  -- lane order within one heat and never a standing (§4.6).
  place integer,
  status text not null default 'ok', -- ok | dns | dnf | dq
  source text not null,              -- import | manual
  overridden_by text,
  override_reason text,
  -- Verbatim source line, kept so an operator reviewing a flagged row can
  -- see exactly what the file said (§4.6's "source line shown verbatim").
  source_line text,
  -- Set for rows the parser could not fully trust: a revised block, or
  -- backup columns disagreeing with the official TIME column (§4.6).
  needs_review boolean not null default false,
  primary key (league_id, athlete_no),
  foreign key (organization_id, athlete_no) references athlete (organization_id, athlete_no)
);

alter table swim_result enable row level security;

create trigger swim_result_set_organization
  before insert or update on swim_result
  for each row execute function private.set_organization_from_league();

create index swim_result_heat_lane_idx on swim_result (league_id, heat, lane);

create policy "Officials can manage their leagues' swim results"
  on swim_result for all
  to authenticated
  using (private.has_league_role(league_id, 'official'))
  with check (private.has_league_role(league_id, 'official'));

-- Operator notes (#19). Free text an operator writes on a capture screen to
-- help reconciliation correct an error they saw happen.
--
-- Append-only, and more strictly so than the capture tables: there is no
-- voided/void_reason pair here, because a note is never wrong — it is what
-- the operator said at the time. A correction is another note.
--
-- `anchor` is the latest active capture on the note's screen when it was
-- written: time_capture.seq for the Timer screen, position_capture.position
-- for the Position screen, and 0 before the first finisher. Anchoring on a
-- capture rather than a row number keeps the note with that capture while
-- the official inserts gaps or removes rows on reconciliation (§4.5).
-- One column serves both screens; `screen` says which counter it is.

create table operator_note (
  id text primary key,              -- ULID, client-generated (§5.8)
  league_id integer not null references league (id),
  run_heat integer not null,
  anchor integer not null check (anchor >= 0),
  screen text not null check (screen in ('timer', 'position')),
  body text not null check (body <> ''),
  device_id text not null,
  created_at timestamptz not null
);

alter table operator_note enable row level security;

create index operator_note_run_heat_idx
  on operator_note (league_id, run_heat);

-- Insert and select only, so the never-edit rule holds at the database and
-- not just in the client. RLS covers update and delete; it does not cover
-- truncate, so that privilege is revoked outright — this is the one table
-- whose whole point is that nothing already written can change.
create policy "Team members can read their leagues' operator notes"
  on operator_note for select
  to authenticated
  using (private.has_league_role(league_id));

-- A note is written on a capture screen, so it takes that screen's Role.
create policy "Capture operators can add operator notes"
  on operator_note for insert
  to authenticated
  with check (
    case screen
      when 'timer' then private.has_league_role(league_id, 'timekeeper')
      when 'position' then private.has_league_role(league_id, 'placer')
    end
  );

revoke update, delete, truncate on operator_note from anon, authenticated;

-- Reconciliation (§4.5/§5.3) subscribes to these tables so the screen
-- updates live as captures and notes sync in from field phones.
alter publication supabase_realtime add table position_capture;
alter publication supabase_realtime add table time_capture;
alter publication supabase_realtime add table operator_note;
-- Every phone subscribes to league_race so its capture screens stop or
-- resume taking captures as soon as a heat closes or reopens.
alter publication supabase_realtime add table league_race;
