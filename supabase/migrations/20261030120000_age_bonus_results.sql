-- The age bonus on the results page (#79). Athletes get an estimated birth year
-- (ADR 0007), points table rows say which season they apply to, and the public
-- results return each athlete's bonus. Birth years are never returned.

alter table public.athlete
  add column birth_year integer;

comment on column public.athlete.birth_year is
  'Estimated, not exact: the year ages were taken minus the age given, so the age at the end of a season year may be a year out (ADR 0007).';

-- The 2027 fills the current table's rows; later seasons must give their own.
alter table public.points_table
  add column season_year integer not null default 2027;
alter table public.points_table
  alter column season_year drop default;

-- The age bonus (#78): points for each year an athlete is above the bottom of
-- their age band at the end of the season year, never below 0. A missing birth
-- year gives 0. The one place the formula lives.
create function private.age_bonus_points(
  season_year integer,
  birth_year integer,
  age_from integer,
  bonus_points_per_year numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(
    0,
    coalesce((season_year - birth_year - age_from) * bonus_points_per_year, 0)
  );
$$;

-- The return type changes, so it can't be replaced in place.
drop function private.published_times(integer);

-- Every athlete entered in a League with their published times: a run time
-- once its heat is Closed (ADR 0001), a swim time whenever it is recorded and
-- ok. Shared by the public results and the Medals screen, so the two can't
-- disagree. Athletes with no time at all are included; callers decide. The age
-- bonus comes from the points table row that applies on the League's date, for
-- the age group on the entry, so an Unclassified athlete has a null bonus.
-- birth_year is never returned.
create function private.published_times(target_league_id integer)
returns table (
  athlete_no integer,
  full_name text,
  gender public.gender,
  age_group_code text,
  run_time text,
  swim_time text,
  bonus_points numeric
)
language sql
stable
set search_path = ''
as $$
  select e.athlete_no, a.full_name, a.gender, e.age_group_code,
    run.run_time, swim.swim_time, bonus.bonus_points
  from public.entry e
  join public.athlete a
    on a.organization_id = e.organization_id and a.athlete_no = e.athlete_no
  left join lateral (
    select rr.run_time
    from public.run_result rr
    join public.league_race r
      on r.league_id = rr.league_id and r.run_heat = rr.run_heat
    where rr.league_id = e.league_id
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
    where sr.league_id = e.league_id
      and sr.athlete_no = e.athlete_no
      and sr.status = 'ok'
      and sr.swim_time is not null
  ) swim on true
  left join lateral (
    select private.age_bonus_points(
      p.season_year, a.birth_year, p.age_from, p.bonus_points_per_year
    ) as bonus_points
    from public.points_table p
    join public.league l on l.id = e.league_id
    where p.gender = a.gender
      and p.age_group_code = e.age_group_code
      and p.effective_from = (
        select max(p2.effective_from) from public.points_table p2
        where p2.effective_from <= l.league_date
      )
  ) bonus on true
  where e.league_id = target_league_id;
$$;

revoke execute on function private.age_bonus_points(integer, integer, integer, numeric) from public, anon, authenticated;
revoke execute on function private.published_times(integer) from public, anon, authenticated;

-- Published results for anyone: the heat counts and, per athlete, the times
-- that are published, with the points table that applies on the League's
-- date, and the age bonus. Athlete numbers and birth years are not returned,
-- and an athlete with no time at all is left out: they did not show up.
create or replace function public.league_results(slug text)
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
    'pool_length_m', l.pool_length_m,
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
          'full_name', t.full_name,
          'gender', t.gender,
          'age_group_code', t.age_group_code,
          'run_time', t.run_time,
          'swim_time', t.swim_time,
          'bonus_points', t.bonus_points
        )
        order by t.full_name, t.athlete_no
      )
      from private.published_times(l.id) t
      where t.run_time is not null or t.swim_time is not null
    ), '[]'::jsonb),
    'points_table', private.league_points_table(l.id)
  )
  from public.league l
  join public.organization o on o.id = l.organization_id
  where l.results_slug = slug and l.visibility <> 'private';
$$;
