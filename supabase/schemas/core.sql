-- Core tables. See biathlon-technical-spec.md §6.1-6.2.

create type gender as enum ('M', 'F');

create table athlete (
  athlete_no integer primary key,
  first_name text not null,
  last_name text not null,
  gender gender not null
);

alter table athlete enable row level security;

create table meet (
  id integer primary key generated always as identity,
  name text not null,
  meet_date date not null,
  season integer not null
);

alter table meet enable row level security;

-- age_group_code is intentionally not an FK to points_table: that table's key
-- includes effective_from/gender, which entry doesn't carry. Validated at
-- import time instead (see spec §6.1's trade-off note).
create table entry (
  meet_id integer not null references meet (id),
  athlete_no integer not null references athlete (athlete_no),
  run_heat integer not null,
  swim_heat integer not null,
  swim_lane integer not null,
  age_group_code text not null,
  primary key (meet_id, athlete_no)
);

alter table entry enable row level security;

create index entry_run_heat_idx on entry (meet_id, run_heat);
create index entry_swim_heat_lane_idx on entry (meet_id, swim_heat, swim_lane);

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
