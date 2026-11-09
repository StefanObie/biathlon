-- An Off-roster run counts (#97, ADR 0008): when an athlete has ok Run
-- results in several Closed heats, the one in their roster heat counts, else
-- the lowest-numbered heat's. The export picks the same Run result, so the
-- public results, Medals and the export agree.

-- Every athlete entered in a League with their published times: a run time
-- once its heat is Closed (ADR 0001), a swim time whenever it is recorded and
-- ok. With ok runs in several Closed heats, the roster heat's counts, else the
-- lowest-numbered heat's, as in the export (ADR 0008). Shared by the public
-- results and the Medals screen, so the two can't disagree. Athletes with no
-- time at all are included; callers decide. The age
-- bonus comes from the points table row that applies on the League's date, for
-- the age group on the entry, so an Unclassified athlete has a null bonus.
-- missing_age says the row has a bonus rate above 0 but no birth year to use it
-- with. birth_year is never returned.
create or replace function private.published_times(target_league_id integer)
returns table (
  athlete_no integer,
  full_name text,
  gender public.gender,
  age_group_code text,
  run_time text,
  swim_time text,
  bonus_points numeric,
  missing_age boolean
)
language sql
stable
set search_path = ''
as $$
  select e.athlete_no, a.full_name, a.gender, e.age_group_code,
    run.run_time, swim.swim_time, bonus.bonus_points,
    coalesce(bonus.missing_age, false)
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
    order by rr.run_heat = e.run_heat desc, rr.run_heat
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
    ) as bonus_points,
    a.birth_year is null and p.bonus_points_per_year > 0 as missing_age
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
