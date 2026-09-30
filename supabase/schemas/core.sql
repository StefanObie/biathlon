-- Core tables. See biathlon-technical-spec.md §6.1-6.2.

-- Holds security definer helpers and trigger functions. Not in the API's
-- exposed schemas, so nothing here is callable as an RPC.
create schema private;

grant usage on schema private to authenticated;

create type gender as enum ('M', 'F');

create type league_visibility as enum ('public', 'protected', 'private');

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
  organization_id integer not null references organization (id),
  visibility league_visibility not null default 'public',
  results_slug text
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
-- (below), and league_team_member_requires_member (below) then only lets the
-- League's own Organization's Members on its team. It's a trigger rather
-- than a foreign key because a removed Member's ended entries stay.
create table league_team_member (
  id integer primary key generated always as identity,
  league_id integer not null references league (id),
  organization_id integer not null default 0,
  user_id uuid not null,
  role league_role not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
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

-- Default teams (#33). An Organization's standard League team, one row per
-- Role held by one Member. A new League's team starts as a copy of it
-- (copy_default_team, below), and after that the two aren't linked, so
-- changing either leaves the other alone. Nothing's access depends on it,
-- so unlike a League team it keeps no history: removing a Role deletes its
-- row.
create table default_team_member (
  organization_id integer not null,
  user_id uuid not null,
  role league_role not null,
  primary key (organization_id, user_id, role),
  foreign key (organization_id, user_id)
    references organization_member (organization_id, user_id) on delete cascade
);

alter table default_team_member enable row level security;

create index default_team_member_user_idx on default_team_member (user_id);

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

-- Whether the current user held at least min_role on the League at the
-- instant `at`: holds it now (as has_league_role), or had a team entry
-- covering min_role that had started by `at` and not yet ended. This is
-- what a capture is judged by (#36): a phone that was offline syncs late,
-- so a capture made while its Member held the Role is still accepted after
-- they've been removed from the team, and one made after isn't. `at` is
-- the capture's own time, which the phone reports.
create function private.had_league_role(
  target_league_id integer,
  min_role league_role,
  at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_league_role(target_league_id, min_role)
    or exists (
      select 1 from public.league_team_member t
      where t.league_id = target_league_id
        and t.user_id = (select auth.uid())
        and t.started_at <= at
        and t.ended_at > at
        and private.role_covers(t.role, min_role)
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

-- Only Admins see or change the Default team. Changing a Role is adding or
-- removing a row, so there's no update.
create policy "Admins can read their organizations' default teams"
  on default_team_member for select
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can add to default teams"
  on default_team_member for insert
  to authenticated
  with check (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can remove from default teams"
  on default_team_member for delete
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

revoke update, truncate on default_team_member from anon, authenticated;

-- A new League's team starts as a copy of its Organization's Default team.
-- security definer so the copy doesn't depend on the creator's own access
-- to either team; the League insert itself is still checked by RLS. Each
-- copied entry is written to the League's audit log like any other team
-- change (audit_league_team_change, below).
create function private.copy_default_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.league_team_member (league_id, user_id, role)
  select new.id, d.user_id, d.role
  from public.default_team_member d
  where d.organization_id = new.organization_id;
  return null;
end;
$$;

create trigger league_copy_default_team
  after insert on league
  for each row execute function private.copy_default_team();

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

-- Every capture and operator note records its author (#36): the Member
-- whose session wrote it, whatever the phone sent. Voiding a capture
-- doesn't change who made it. Rows written before #36, and rows written
-- without a session (seeding), have no author; RLS only lets a signed-in
-- Member write, so everything written through the API has one. author_id
-- has no foreign key to auth.users, so a capture outlives its author's
-- account.
create function private.set_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := (select auth.uid());
  else
    new.author_id := old.author_id;
  end if;
  return new;
end;
$$;

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
  author_id uuid,
  foreign key (organization_id, athlete_no) references athlete (organization_id, athlete_no)
);

alter table position_capture enable row level security;

create trigger position_capture_set_organization
  before insert or update on position_capture
  for each row execute function private.set_organization_from_league();

create trigger position_capture_set_author
  before insert or update on position_capture
  for each row execute function private.set_author();

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
  void_reason text,
  author_id uuid
);

alter table time_capture enable row level security;

create trigger time_capture_set_author
  before insert or update on time_capture
  for each row execute function private.set_author();

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

-- Most audit rows are about one League. Changes to the Organization itself,
-- such as its Default team, belong to no League and name the Organization
-- instead; a row names exactly one of the two.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  league_id integer references league (id),
  organization_id integer references organization (id),
  at timestamptz not null default now(),
  actor text not null,
  entity text not null,
  action text not null,
  before jsonb,
  after jsonb,
  reason text,
  check ((league_id is null) <> (organization_id is null))
);

alter table audit_log enable row level security;

create index audit_log_league_idx on audit_log (league_id);
create index audit_log_organization_idx on audit_log (organization_id);

-- Captures are added and voided (the phones sync by upsert, so both insert
-- and update), never deleted. A capture is added if its author held the
-- Role when they made it (private.had_league_role), so one that syncs late
-- from a phone that was offline isn't lost when its Member has since left
-- the team. Voiding takes the Role now, or for the capture's own author
-- the Role they held when they made it: a void made offline, or a push
-- resent after its reply was lost, reaches the server as an update and
-- mustn't be refused once they've left. Authors can read their own
-- captures because the phones' upserts need the new row to be readable,
-- and a removed Member can read nothing else of the League.
create policy "Team members can read their leagues' position captures"
  on position_capture for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Authors can read their own position captures"
  on position_capture for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Placers can add position captures"
  on position_capture for insert
  to authenticated
  with check (private.had_league_role(league_id, 'placer', scanned_at));

create policy "Placers can void position captures"
  on position_capture for update
  to authenticated
  using (
    private.has_league_role(league_id, 'placer')
    or (
      author_id = (select auth.uid())
      and private.had_league_role(league_id, 'placer', scanned_at)
    )
  )
  with check (
    private.has_league_role(league_id, 'placer')
    or (
      author_id = (select auth.uid())
      and private.had_league_role(league_id, 'placer', scanned_at)
    )
  );

create policy "Team members can read their leagues' time captures"
  on time_capture for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Authors can read their own time captures"
  on time_capture for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Timekeepers can add time captures"
  on time_capture for insert
  to authenticated
  with check (private.had_league_role(league_id, 'timekeeper', captured_at));

create policy "Timekeepers can void time captures"
  on time_capture for update
  to authenticated
  using (
    private.has_league_role(league_id, 'timekeeper')
    or (
      author_id = (select auth.uid())
      and private.had_league_role(league_id, 'timekeeper', captured_at)
    )
  )
  with check (
    private.has_league_role(league_id, 'timekeeper')
    or (
      author_id = (select auth.uid())
      and private.had_league_role(league_id, 'timekeeper', captured_at)
    )
  );

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

-- Default team changes go to the Organization's audit log, for the same
-- reasons as League team changes above.
create function private.audit_default_team_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.default_team_member;
  team_entry jsonb;
  actor text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
begin
  if tg_op = 'INSERT' then
    changed := new;
  else
    changed := old;
  end if;
  team_entry := jsonb_build_object(
    'user_id', changed.user_id,
    'email', (select email from auth.users where id = changed.user_id),
    'role', changed.role
  );

  if tg_op = 'INSERT' then
    insert into public.audit_log (organization_id, actor, entity, action, after)
    values (changed.organization_id, actor, 'default_team', 'add-role', team_entry);
  else
    insert into public.audit_log (organization_id, actor, entity, action, before)
    values (changed.organization_id, actor, 'default_team', 'remove-role', team_entry);
  end if;
  return null;
end;
$$;

create trigger default_team_member_audit
  after insert or delete on default_team_member
  for each row execute function private.audit_default_team_change();

-- Nothing edits or removes an audit row once it's written. A League's rows
-- are read by its Officials, and an Organization's own rows by its Admins.
create policy "Officials can read their leagues' audit log"
  on audit_log for select
  to authenticated
  using (private.has_league_role(league_id, 'official'));

create policy "Admins can read their organizations' audit log"
  on audit_log for select
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

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
  created_at timestamptz not null,
  author_id uuid
);

alter table operator_note enable row level security;

create index operator_note_run_heat_idx
  on operator_note (league_id, run_heat);

create trigger operator_note_set_author
  before insert on operator_note
  for each row execute function private.set_author();

-- Insert and select only, so the never-edit rule holds at the database and
-- not just in the client. RLS covers update and delete; it does not cover
-- truncate, so that privilege is revoked outright — this is the one table
-- whose whole point is that nothing already written can change.
create policy "Team members can read their leagues' operator notes"
  on operator_note for select
  to authenticated
  using (private.has_league_role(league_id));

-- For the phones' upserts, as with captures.
create policy "Authors can read their own operator notes"
  on operator_note for select
  to authenticated
  using (author_id = (select auth.uid()));

-- A note is written on a capture screen, so it takes that screen's Role,
-- held when the note was written, like a capture.
create policy "Capture operators can add operator notes"
  on operator_note for insert
  to authenticated
  with check (
    case screen
      when 'timer' then private.had_league_role(league_id, 'timekeeper', created_at)
      when 'position' then private.had_league_role(league_id, 'placer', created_at)
    end
  );

revoke update, delete, truncate on operator_note from anon, authenticated;

-- Call room check-ins (#41): a flag saying an athlete has reported to the
-- Call room, not a Capture. One row per (League, athlete number): the heat
-- they were checked in at, when, and by whom. Checking in at another heat
-- updates the row; undoing deletes it. The key is the entry's, so an
-- athlete has to be entered in the League.
create table call_room_check_in (
  league_id integer not null,
  athlete_no integer not null,
  run_heat integer not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid,
  primary key (league_id, athlete_no),
  foreign key (league_id, athlete_no) references entry (league_id, athlete_no)
    on delete cascade
);

alter table call_room_check_in enable row level security;

-- The time and the Member are the database's, whatever the phone sent.
create function private.stamp_check_in()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.checked_in_at := now();
  new.checked_in_by := (select auth.uid());
  return new;
end;
$$;

create trigger call_room_check_in_stamp
  before insert or update on call_room_check_in
  for each row execute function private.stamp_check_in();

-- Whether a heat has been closed by an Official (ADR 0001).
create function private.heat_is_closed(target_league_id integer, target_run_heat integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_race r
    where r.league_id = target_league_id
      and r.run_heat = target_run_heat
      and r.closed_at is not null
  );
$$;

create policy "Team members can read their leagues' check-ins"
  on call_room_check_in for select
  to authenticated
  using (private.has_league_role(league_id));

-- A Closed heat is read-only, including moving an athlete away from it.
create policy "Callers can check in athletes to open heats"
  on call_room_check_in for insert
  to authenticated
  with check (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  );

create policy "Callers can move check-ins between open heats"
  on call_room_check_in for update
  to authenticated
  using (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  )
  with check (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  );

create policy "Callers can undo check-ins on open heats"
  on call_room_check_in for delete
  to authenticated
  using (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  );

-- Reconciliation (§4.5/§5.3) subscribes to these tables so the screen
-- updates live as captures and notes sync in from field phones.
alter publication supabase_realtime add table position_capture;
alter publication supabase_realtime add table time_capture;
alter publication supabase_realtime add table operator_note;
-- Every phone subscribes to league_race so its capture screens stop or
-- resume taking captures as soon as a heat closes or reopens.
alter publication supabase_realtime add table league_race;
-- Callers see each other's check-ins live.
alter publication supabase_realtime add table call_room_check_in;

-- Invitations (#34). An Admin invites someone by email to become a Member
-- of their Organization, optionally with one Role on the Default team or on
-- one League's team (league_id null means the Default team). The link in
-- the email carries a secret that is stored only as a hash: nobody can read
-- secret_hash through the API, Admins included, and Admins only see the
-- other columns. Sending, cancelling and accepting all go through the
-- functions below, never direct writes.
--
-- "Open" means neither accepted nor cancelled, expired or not. An email has
-- at most one open Invitation per Organization, and sending again replaces
-- it. A pending Invitation is an open one that hasn't expired.
--
-- league_id has no foreign key: a League that has since gone must not take
-- the Invitation with it, and accepting one skips the team entry instead.
create table invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null references organization (id),
  email text not null check (email <> '' and email = lower(trim(email))),
  role league_role,
  league_id integer,
  secret_hash text not null,
  invited_by uuid not null,
  invited_by_email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  check (league_id is null or role is not null),
  check (accepted_at is null or cancelled_at is null)
);

alter table invitation enable row level security;

create unique index invitation_open_idx
  on invitation (organization_id, email)
  where accepted_at is null and cancelled_at is null;
create unique index invitation_secret_hash_idx on invitation (secret_hash);

revoke all on invitation from anon, authenticated;
grant select (
  id, organization_id, email, role, league_id, invited_by, invited_by_email,
  created_at, expires_at, accepted_at, cancelled_at
) on invitation to authenticated;

create policy "Admins can read their organizations' invitations"
  on invitation for select
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

-- Sends an Invitation, or replaces the Organization's open one for that
-- email. The caller's app makes the secret and passes only its hash.
create function public.send_invitation(
  org_id integer,
  invitee_email text,
  invitee_role league_role,
  invitee_league_id integer,
  new_secret_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(coalesce(invitee_email, '')));
  sender_email text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
  existing public.invitation;
  invitation_id uuid;
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin can invite Members' using errcode = '42501';
  end if;
  if normalized = '' or position('@' in normalized) = 0 then
    raise exception 'An invitation needs an email address' using errcode = '22023';
  end if;
  if coalesce(new_secret_hash, '') = '' then
    raise exception 'An invitation needs a secret' using errcode = '22023';
  end if;
  if invitee_league_id is not null and invitee_role is null then
    raise exception 'A league needs a role' using errcode = '22023';
  end if;
  if invitee_league_id is not null and not exists (
    select 1 from public.league l
    where l.id = invitee_league_id and l.organization_id = org_id
  ) then
    raise exception 'That league does not exist' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.organization_member m
    join auth.users u on u.id = m.user_id
    where m.organization_id = org_id and lower(u.email) = normalized
  ) then
    raise exception '% is already a Member', normalized using errcode = '23505';
  end if;

  select * into existing
  from public.invitation i
  where i.organization_id = org_id
    and i.email = normalized
    and i.accepted_at is null
    and i.cancelled_at is null
  for update;

  if found then
    update public.invitation
    set role = invitee_role,
        league_id = invitee_league_id,
        secret_hash = new_secret_hash,
        invited_by = (select auth.uid()),
        invited_by_email = sender_email,
        created_at = now(),
        expires_at = now() + interval '7 days'
    where id = existing.id
    returning id into invitation_id;

    insert into public.audit_log (organization_id, actor, entity, action, before, after)
    values (
      org_id, sender_email, 'invitation', 'invitation.replaced',
      jsonb_build_object('email', normalized, 'role', existing.role, 'league_id', existing.league_id),
      jsonb_build_object('email', normalized, 'role', invitee_role, 'league_id', invitee_league_id)
    );
  else
    insert into public.invitation (
      organization_id, email, role, league_id, secret_hash, invited_by, invited_by_email
    )
    values (
      org_id, normalized, invitee_role, invitee_league_id, new_secret_hash,
      (select auth.uid()), sender_email
    )
    returning id into invitation_id;

    insert into public.audit_log (organization_id, actor, entity, action, after)
    values (
      org_id, sender_email, 'invitation', 'invitation.sent',
      jsonb_build_object('email', normalized, 'role', invitee_role, 'league_id', invitee_league_id)
    );
  end if;

  return invitation_id;
end;
$$;

revoke execute on function public.send_invitation(integer, text, league_role, integer, text) from public, anon;
grant execute on function public.send_invitation(integer, text, league_role, integer, text) to authenticated;

-- Cancels a pending Invitation. Anything else, including someone else's
-- Organization's, is reported the same way as one that doesn't exist.
create function public.cancel_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invitation;
begin
  select * into target
  from public.invitation i
  where i.id = invitation_id
    and private.is_org_member(i.organization_id, as_admin => true)
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'No such pending invitation' using errcode = 'P0002';
  end if;

  update public.invitation set cancelled_at = now() where id = target.id;

  insert into public.audit_log (organization_id, actor, entity, action, before)
  values (
    target.organization_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'invitation', 'invitation.cancelled',
    jsonb_build_object('email', target.email, 'role', target.role, 'league_id', target.league_id)
  );
end;
$$;

revoke execute on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.cancel_invitation(uuid) to authenticated;

-- Accepts the Invitation behind a link's secret for a user whose email it
-- names: makes them a Member, adds the team entry if any (skipped if the
-- League has since gone), and uses the Invitation up. Only the app's server
-- calls this, with the service role, after it has worked out which user the
-- link's email belongs to; the email check here means it can still only
-- ever accept for the invited email. Returns where the invitee should land.
create function public.accept_invitation(secret_hash_in text, accepting_user uuid)
returns table (
  landing_organization_id integer,
  landing_role league_role,
  landing_league_id integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invitation;
  user_email text;
  applied_league_id integer;
begin
  select * into target
  from public.invitation i
  where i.secret_hash = secret_hash_in
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation can no longer be used' using errcode = 'P0002';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = accepting_user;
  if user_email is distinct from target.email then
    raise exception 'This invitation is for a different email' using errcode = '42501';
  end if;

  update public.invitation set accepted_at = now() where id = target.id;

  insert into public.organization_member (organization_id, user_id)
  values (target.organization_id, accepting_user)
  on conflict do nothing;

  if target.role is not null and target.league_id is null then
    insert into public.default_team_member (organization_id, user_id, role)
    values (target.organization_id, accepting_user, target.role)
    on conflict do nothing;
  elsif target.role is not null and exists (
    select 1 from public.league l
    where l.id = target.league_id and l.organization_id = target.organization_id
  ) then
    insert into public.league_team_member (league_id, user_id, role)
    values (target.league_id, accepting_user, target.role)
    on conflict (league_id, user_id, role) where ended_at is null do nothing;
    applied_league_id := target.league_id;
  end if;

  insert into public.audit_log (organization_id, actor, entity, action, after)
  values (
    target.organization_id, user_email, 'invitation', 'invitation.accepted',
    jsonb_build_object(
      'email', target.email, 'role', target.role, 'league_id', target.league_id,
      'league_team_entry_added', applied_league_id is not null
    )
  );

  return query select
    target.organization_id,
    target.role,
    applied_league_id;
end;
$$;

revoke execute on function public.accept_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid) to service_role;

-- The Organizations that have a pending Invitation for the signed-in
-- user's email, so a user who signs in before following the link isn't sent
-- to create an Organization of their own. Invitations are otherwise
-- readable only by the Organization's Admins.
create function public.my_pending_invitations()
returns table (organization_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.expires_at
  from public.invitation i
  join public.organization o on o.id = i.organization_id
  where i.email = lower((select auth.jwt() ->> 'email'))
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  order by i.expires_at;
$$;

revoke execute on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;

-- Managing Members and Admins (#35). An Admin makes another Member an
-- Admin, demotes an Admin, or removes a Member from the Organization.
-- Nobody writes organization_member directly; the functions below do, and
-- write each change to the Organization's audit log.

-- An Organization never loses its last Admin: the database refuses to
-- demote or remove the only one, however the change is made. A Member
-- going because the Organization itself is being deleted is not a loss.
create function private.keep_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and not (old.is_admin and not new.is_admin) then
    return new;
  end if;
  if not old.is_admin then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE'
    and not exists (select 1 from public.organization where id = old.organization_id)
  then
    return old;
  end if;
  if not exists (
    select 1 from public.organization_member m
    where m.organization_id = old.organization_id
      and m.user_id <> old.user_id
      and m.is_admin
  ) then
    raise exception 'An organization must keep at least one Admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger organization_member_keep_last_admin
  before update or delete on organization_member
  for each row execute function private.keep_last_admin();

-- A removed Member's League team entries are ended, not deleted, so the
-- teams' history survives them. That means a team entry can outlive its
-- membership, so there is no foreign key to organization_member; instead a check
-- runs when an entry is added. It runs after set_organization_from_league
-- (triggers fire in name order) so it sees the entry's Organization.
create function private.league_team_member_requires_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_member m
    where m.organization_id = new.organization_id and m.user_id = new.user_id
  ) then
    raise exception 'Only a Member of the organization can be on a league team'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger league_team_member_validate_member
  before insert on league_team_member
  for each row execute function private.league_team_member_requires_member();

-- Makes a Member an Admin, or demotes an Admin back to an ordinary Member.
-- Does nothing if they already are what was asked for. Demoting the last
-- Admin is refused by keep_last_admin.
create function public.set_member_admin(org_id integer, member_user_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.organization_member;
  member_email text;
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin can manage Members' using errcode = '42501';
  end if;

  select * into target
  from public.organization_member m
  where m.organization_id = org_id and m.user_id = member_user_id
  for update;
  if not found then
    raise exception 'No such Member' using errcode = 'P0002';
  end if;
  if target.is_admin = make_admin then
    return;
  end if;

  update public.organization_member
  set is_admin = make_admin
  where organization_id = org_id and user_id = member_user_id;

  select u.email into member_email from auth.users u where u.id = member_user_id;
  insert into public.audit_log (organization_id, actor, entity, action, before, after)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'member',
    case when make_admin then 'member.made-admin' else 'member.demoted' end,
    jsonb_build_object('user_id', member_user_id, 'email', member_email, 'is_admin', target.is_admin),
    jsonb_build_object('user_id', member_user_id, 'email', member_email, 'is_admin', make_admin)
  );
end;
$$;

revoke execute on function public.set_member_admin(integer, uuid, boolean) from public, anon;
grant execute on function public.set_member_admin(integer, uuid, boolean) to authenticated;

-- Removes a Member from the Organization. Their entries on its Default
-- team go, and their entries on its Leagues' teams are ended, so they lose
-- access to every League of the Organization. Removing the last Admin is
-- refused by keep_last_admin.
create function public.remove_member(org_id integer, member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.organization_member;
  member_email text;
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin can manage Members' using errcode = '42501';
  end if;

  select * into target
  from public.organization_member m
  where m.organization_id = org_id and m.user_id = member_user_id
  for update;
  if not found then
    raise exception 'No such Member' using errcode = 'P0002';
  end if;

  update public.league_team_member
  set ended_at = now()
  where organization_id = org_id and user_id = member_user_id and ended_at is null;

  delete from public.default_team_member
  where organization_id = org_id and user_id = member_user_id;

  delete from public.organization_member
  where organization_id = org_id and user_id = member_user_id;

  select u.email into member_email from auth.users u where u.id = member_user_id;
  insert into public.audit_log (organization_id, actor, entity, action, before)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'member',
    'member.removed',
    jsonb_build_object('user_id', member_user_id, 'email', member_email, 'is_admin', target.is_admin)
  );
end;
$$;

revoke execute on function public.remove_member(integer, uuid) from public, anon;
grant execute on function public.remove_member(integer, uuid) to authenticated;

-- Visibility and the Results slug (#28). Visibility says who can see a
-- League's published results without signing in; the Results slug is the
-- part of the results address that identifies the League. A Public League
-- has a readable slug an Admin can change, a Protected League a random one
-- (which is its Results link), and a Private League none.
-- Lowercase letters and digits with single hyphens between them, and no
-- hyphen at either end. Mirrors normaliseSlug in lib/results/slug.ts.
create function private.normalise_slug(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(input), '[^a-z0-9]+', '-', 'g'));
$$;

-- The default Public slug: the Organization name and League name,
-- hyphenated, with a counter (-2, -3, ...) until no League has it. Mirrors
-- defaultSlug in lib/results/slug.ts. The unique constraint is the real
-- guard; two Leagues created at the same moment can still race here, and
-- the loser's insert fails and is retried.
create function private.default_results_slug(org_id integer, league_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  select private.normalise_slug(o.name || ' ' || league_name) into base
  from public.organization o where o.id = org_id;
  base := trim(both '-' from left(coalesce(base, ''), 80));
  if char_length(base) < 3 then
    base := 'league';
  end if;
  loop
    candidate := case when n = 1 then base else
      trim(both '-' from left(base, 80 - char_length('-' || n))) || '-' || n end;
    exit when not exists (select 1 from public.league l where l.results_slug = candidate);
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

-- Every existing League was visible only to its Members, and Public is the
-- new default, so each gets its default slug.
do $$
declare
  l record;
begin
  for l in select id, organization_id, name from public.league order by id loop
    update public.league
    set results_slug = private.default_results_slug(l.organization_id, l.name)
    where id = l.id;
  end loop;
end;
$$;

-- A League created without a slug (a test fixture, a script) gets the
-- default Public one. The app sets its own, so it can retry on a collision.
create function private.set_default_results_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'public' and new.results_slug is null then
    new.results_slug := private.default_results_slug(new.organization_id, new.name);
  end if;
  return new;
end;
$$;

create trigger league_default_results_slug
  before insert on league
  for each row execute function private.set_default_results_slug();

alter table league
  add constraint league_results_slug_key unique (results_slug),
  add constraint league_results_slug_format check (
    coalesce(
      case visibility
        when 'private' then results_slug is null
        when 'public' then
          results_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          and char_length(results_slug) between 3 and 80
        -- Random: 22 or more URL-safe characters including an uppercase
        -- letter, so it can never be a valid custom slug.
        else results_slug ~ '^[A-Za-z0-9_-]{22,}$' and results_slug ~ '[A-Z]'
      end,
      false
    )
  );

-- Published results for anyone: the heat counts and, per athlete, the times
-- that are published (a run time once its heat is Closed, ADR 0001; a swim time
-- whenever it exists), with the points table that applies on the League's
-- date. Athlete numbers are not returned, and an athlete with no time at all
-- is left out: they did not show up.
create function public.league_results(slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', l.name,
    'organization_name', o.name,
    'league_date', l.league_date,
    'season', l.season,
    'visibility', l.visibility,
    'heats_total', (
      select count(distinct e.run_heat) from public.entry e where e.league_id = l.id
    ),
    'heats_closed', (
      select count(distinct r.run_heat) from public.league_race r
      where r.league_id = l.id and r.closed_at is not null
        and exists (
          select 1 from public.entry e
          where e.league_id = l.id and e.run_heat = r.run_heat
        )
    ),
    'athletes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'full_name', a.full_name,
          'gender', a.gender,
          'age_group_code', e.age_group_code,
          'run_time', run.run_time,
          'swim_time', swim.swim_time
        )
        order by a.full_name, e.athlete_no
      )
      from public.entry e
      join public.athlete a
        on a.organization_id = e.organization_id and a.athlete_no = e.athlete_no
      left join lateral (
        select rr.run_time
        from public.run_result rr
        join public.league_race r
          on r.league_id = rr.league_id and r.run_heat = rr.run_heat
        where rr.league_id = l.id
          and rr.athlete_no = e.athlete_no
          and rr.status = 'ok'
          and rr.run_time is not null
          and r.closed_at is not null
        order by rr.run_heat
        limit 1
      ) run on true
      left join lateral (
        select sr.swim_time
        from public.swim_result sr
        where sr.league_id = l.id
          and sr.athlete_no = e.athlete_no
          and sr.status = 'ok'
          and sr.swim_time is not null
      ) swim on true
      where e.league_id = l.id
        and (run.run_time is not null or swim.swim_time is not null)
    ), '[]'::jsonb),
    'points_table', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'gender', p.gender,
          'age_group_code', p.age_group_code,
          'age_group_label', p.age_group_label,
          'sort_order', p.sort_order,
          'run_base_time', p.run_base_time,
          'run_points_per_second', p.run_points_per_second,
          'swim_base_time', p.swim_base_time,
          'swim_points_per_second', p.swim_points_per_second
        )
        order by p.gender, p.sort_order
      )
      from public.points_table p
      where p.effective_from = (
        select max(p2.effective_from) from public.points_table p2
        where p2.effective_from <= l.league_date
      )
    ), '[]'::jsonb)
  )
  from public.league l
  join public.organization o on o.id = l.organization_id
  where l.results_slug = slug and l.visibility <> 'private';
$$;

revoke execute on function public.league_results(text) from public;
grant execute on function public.league_results(text) to anon, authenticated;
