-- Core tables. See biathlon-technical-spec.md §6.1-6.2.

-- Holds security definer helpers and trigger functions. Not in the API's
-- exposed schemas, so nothing here is callable as an RPC.
create schema private;

grant usage on schema private to authenticated;

create type gender as enum ('M', 'F');

create table athlete (
  athlete_no integer primary key,
  full_name text not null,
  gender gender not null
);

alter table athlete enable row level security;

-- Organizations (#10, #29). An Organization runs Leagues; its Members are
-- users, and the Admin flag lives on the membership rather than being a
-- per-League Role. Nothing here writes these tables from the app yet —
-- creating Organizations and inviting Members come in later tickets.
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

-- Access helpers: the one place access is decided, used by every policy.
-- security definer so they can read organization_member without tripping
-- its own RLS; they live in `private`, which the API doesn't expose, so
-- they can't be called as RPCs to probe other users' memberships.

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

-- Interim rule until per-League Roles arrive: any Member of the League's
-- Organization has full access to the League. False for a League that
-- doesn't exist.
create function private.can_access_league(target_league_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select private.is_org_member(organization_id)
      from public.league
      where id = target_league_id
    ),
    false
  );
$$;

-- age_group_code is intentionally not an FK to points_table: that table's key
-- includes effective_from/gender, which entry doesn't carry. Validated at
-- import time instead (see spec §6.1's trade-off note).
create table entry (
  league_id integer not null references league (id),
  athlete_no integer not null references athlete (athlete_no),
  run_heat integer not null,
  swim_heat integer not null,
  swim_lane integer not null,
  age_group_code text not null,
  primary key (league_id, athlete_no)
);

alter table entry enable row level security;

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
-- default-deny via RLS-enabled-with-no-anon-policy. Every league-scoped
-- table is open only to Members of the League's Organization
-- (private.can_access_league); the reference points table stays readable
-- by any signed-in user.
--
-- Athletes aren't league-scoped yet: they move under their Organization
-- (ADR 0002) in a later ticket, and until then any signed-in user can
-- manage them.

create policy "Authenticated users can manage athletes"
  on athlete for all
  to authenticated
  using (true)
  with check (true);

create policy "Members can read their organizations"
  on organization for select
  to authenticated
  using (private.is_org_member(id));

create policy "Members can read their organizations' memberships"
  on organization_member for select
  to authenticated
  using (private.is_org_member(organization_id));

create policy "Members can read their organizations' leagues"
  on league for select
  to authenticated
  using (private.is_org_member(organization_id));

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

create policy "Members can manage their leagues' entries"
  on entry for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

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
  athlete_no integer references athlete (athlete_no), -- null = skip, no scan attempted
  device_id text not null,
  scanned_at timestamptz not null,
  voided boolean not null default false,
  void_reason text
);

alter table position_capture enable row level security;

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
  athlete_no integer not null references athlete (athlete_no),
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
  primary key (league_id, athlete_no, run_heat)
);

alter table run_result enable row level security;

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

create policy "Members can manage their leagues' position captures"
  on position_capture for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

create policy "Members can manage their leagues' time captures"
  on time_capture for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

create policy "Members can manage their leagues' league races"
  on league_race for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

create policy "Members can manage their leagues' run results"
  on run_result for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

create policy "Members can manage their leagues' audit log"
  on audit_log for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

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
  athlete_no integer not null references athlete (athlete_no),
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
  primary key (league_id, athlete_no)
);

alter table swim_result enable row level security;

create index swim_result_heat_lane_idx on swim_result (league_id, heat, lane);

create policy "Members can manage their leagues' swim results"
  on swim_result for all
  to authenticated
  using (private.can_access_league(league_id))
  with check (private.can_access_league(league_id));

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
create policy "Members can read their leagues' operator notes"
  on operator_note for select
  to authenticated
  using (private.can_access_league(league_id));

create policy "Members can add operator notes to their leagues"
  on operator_note for insert
  to authenticated
  with check (private.can_access_league(league_id));

revoke update, delete, truncate on operator_note from anon, authenticated;

-- Reconciliation (§4.5/§5.3) subscribes to these tables so the screen
-- updates live as captures and notes sync in from field phones.
alter publication supabase_realtime add table position_capture;
alter publication supabase_realtime add table time_capture;
alter publication supabase_realtime add table operator_note;
-- Every phone subscribes to league_race so its capture screens stop or
-- resume taking captures as soon as a heat closes or reopens.
alter publication supabase_realtime add table league_race;
