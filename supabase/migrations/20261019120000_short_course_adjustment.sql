-- The Short course adjustment (#70): SA Biathlon adds 0.8 s to a swim in a
-- 25 m pool for each turn beyond the ones it makes in a 50 m pool, taken off
-- the swim points at the age group's rate. It applies to the whole 2027
-- season, earlier Leagues included, so it lives on that season's points table
-- rows rather than in code.

-- Every League so far swam in a 25 m pool.
alter table public.league
  add column pool_length_m integer not null default 25
    check (pool_length_m in (25, 50));

-- The 0.8 fills the 2027 season's rows; later seasons must give their own.
alter table public.points_table
  add column short_course_seconds_per_turn numeric not null default 0.8;
alter table public.points_table
  alter column short_course_seconds_per_turn drop default;

-- Published results for anyone: the heat counts and, per athlete, the times
-- that are published (a run time once its heat is Closed, ADR 0001; a swim time
-- whenever it exists), with the points table that applies on the League's
-- date. Athlete numbers are not returned, and an athlete with no time at all
-- is left out: they did not show up.
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
          'swim_distance_m', p.swim_distance_m,
          'swim_base_time', p.swim_base_time,
          'swim_points_per_second', p.swim_points_per_second,
          'short_course_seconds_per_turn', p.short_course_seconds_per_turn
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

-- Sets the Pool length a League's swim session was held in (#70). An Official
-- of the League sets it while importing swim times, but RLS only lets an
-- Admin update a League, so this is security definer and checks the Role
-- itself. A change rescores the League's swim points, so it is audited.
create function public.set_pool_length(target_league_id integer, length_m integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous integer;
begin
  if not private.has_league_role(target_league_id, 'official') then
    raise exception 'Only an Official of the League can change its Pool length'
      using errcode = '42501';
  end if;

  select pool_length_m into previous
  from public.league
  where id = target_league_id
  for update;
  if previous = length_m then
    return;
  end if;

  update public.league
  set pool_length_m = length_m
  where id = target_league_id;

  insert into public.audit_log (league_id, actor, entity, action, before, after)
  values (
    target_league_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'league',
    'league.pool-length-changed',
    jsonb_build_object('pool_length_m', previous),
    jsonb_build_object('pool_length_m', length_m)
  );
end;
$$;

revoke execute on function public.set_pool_length(integer, integer) from public, anon;
grant execute on function public.set_pool_length(integer, integer) to authenticated;
