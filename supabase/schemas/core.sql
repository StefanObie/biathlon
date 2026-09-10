-- Core tables. See biathlon-technical-spec.md §6.1-6.2.

create type gender as enum ('M', 'F');

create table athlete (
  athlete_no integer primary key,
  full_name text not null,
  gender gender not null
);

alter table athlete enable row level security;

create table league (
  id integer primary key generated always as identity,
  name text not null,
  league_date date not null,
  season integer not null
);

alter table league enable row level security;

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

-- Phase 0: no public-facing reads yet (that's Phase 4, §3/§6.1). Every
-- operator screen sits behind Supabase Auth (§5.3), so for now the model is
-- simply "authenticated operator, full access" on the operational tables,
-- and "authenticated read-only" on the reference points table. There's no
-- per-row ownership to check (no user_id column) — anon stays default-deny
-- via RLS-enabled-with-no-anon-policy.

create policy "Authenticated users can manage athletes"
  on athlete for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage leagues"
  on league for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage entries"
  on entry for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read points table"
  on points_table for select
  to authenticated
  using (true);

-- Phase 1 capture and result tables. See spec §6.5-6.6.
--
-- heat_id from the spec is not a real column: a heat is the pair
-- (league_id, run_heat), same as entry (§6.2) — no separate heat table.
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
create table heat_timer_start (
  league_id integer not null references league (id),
  run_heat integer not null,
  started_at timestamptz not null,
  device_id text not null,
  primary key (league_id, run_heat)
);

alter table heat_timer_start enable row level security;

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
  at timestamptz not null default now(),
  actor text not null,
  entity text not null,
  action text not null,
  before jsonb,
  after jsonb,
  reason text
);

alter table audit_log enable row level security;

-- Publish gate (§4.5): a heat's run_result rows aren't visible for export or
-- public display until an official confirms them. Row presence = published,
-- same upsert-not-append shape as heat_timer_start. Reopening deletes the
-- row and requires a reason, logged to audit_log by the caller.
create table heat_publish (
  league_id integer not null references league (id),
  run_heat integer not null,
  published_at timestamptz not null default now(),
  published_by text not null,
  primary key (league_id, run_heat)
);

alter table heat_publish enable row level security;

create policy "Authenticated users can manage position captures"
  on position_capture for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage time captures"
  on time_capture for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage heat timer starts"
  on heat_timer_start for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage run results"
  on run_result for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage audit log"
  on audit_log for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage heat publish"
  on heat_publish for all
  to authenticated
  using (true)
  with check (true);

-- Reconciliation (§4.5/§5.3) subscribes to these two tables so the screen
-- updates live as captures sync in from field phones.
alter publication supabase_realtime add table position_capture;
alter publication supabase_realtime add table time_capture;
