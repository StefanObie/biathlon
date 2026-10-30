-- The age bonus on the Medals screen (#80). league_medals returns each athlete's
-- bonus, so Medal places match the results page, and says which athletes have a
-- bonus rate above 0 but no birth year. Birth years are never returned.

-- The return type changes, so it can't be replaced in place.
drop function private.published_times(integer);

-- Every athlete entered in a League with their published times: a run time
-- once its heat is Closed (ADR 0001), a swim time whenever it is recorded and
-- ok. Shared by the public results and the Medals screen, so the two can't
-- disagree. Athletes with no time at all are included; callers decide. The age
-- bonus comes from the points table row that applies on the League's date, for
-- the age group on the entry, so an Unclassified athlete has a null bonus.
-- missing_age says the row has a bonus rate above 0 but no birth year to use it
-- with. birth_year is never returned.
create function private.published_times(target_league_id integer)
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

revoke execute on function private.published_times(integer) from public, anon, authenticated;

-- What the Medals screen ranks (#76): the same published times and points
-- table as league_results, for any League an Official is on, whatever its
-- Visibility. Athlete numbers are returned, and athletes with no time are
-- too, so the screen can count who is still missing one. Each has their age
-- bonus and whether their age is missing; birth years are never returned.
create or replace function public.league_medals(target_league_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_league_role(target_league_id, 'official') then
    raise exception 'Only an Official of the League can see its medals'
      using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'pool_length_m', l.pool_length_m,
      'athletes', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'athlete_no', t.athlete_no,
            'full_name', t.full_name,
            'gender', t.gender,
            'age_group_code', t.age_group_code,
            'run_time', t.run_time,
            'swim_time', t.swim_time,
            'bonus_points', t.bonus_points,
            'missing_age', t.missing_age
          )
          order by t.full_name, t.athlete_no
        )
        from private.published_times(l.id) t
      ), '[]'::jsonb),
      'points_table', private.league_points_table(l.id)
    )
    from public.league l
    where l.id = target_league_id
  );
end;
$$;
