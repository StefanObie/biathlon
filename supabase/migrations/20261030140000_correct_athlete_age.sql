-- An Official corrects one athlete's age (#81). correct_athlete_age is the only
-- way anyone signed in can write birth_year, so every change has an audit row.
revoke insert, update on public.athlete from anon, authenticated;
grant insert (organization_id, athlete_no, full_name, gender) on public.athlete to authenticated;
grant update (organization_id, athlete_no, full_name, gender) on public.athlete to authenticated;

-- Stores the age as the current year minus the age, like the estimate from an
-- age file (ADR 0007). Returns the Leagues the athlete is entered in, whose
-- cached results need refreshing. Their ids, not their slugs: an Official may
-- not be on those Leagues, and a Protected League's slug is its secret.
create function public.correct_athlete_age(org_id integer, target_athlete_no integer, age integer)
returns integer[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous integer;
  corrected integer;
begin
  if not private.has_org_role(org_id, 'official') then
    raise exception 'Only an Official of the Organization can correct an age'
      using errcode = '42501';
  end if;
  if age is null or age not between 5 and 100 then
    raise exception 'Age must be between 5 and 100.' using errcode = '22023';
  end if;

  select a.birth_year into previous
  from public.athlete a
  where a.organization_id = org_id and a.athlete_no = target_athlete_no
  for update;
  if not found then
    raise exception 'Athlete % is not an athlete of this organization', target_athlete_no
      using errcode = '22023';
  end if;

  corrected := extract(year from now() at time zone 'Africa/Johannesburg')::integer - age;

  update public.athlete
  set birth_year = corrected
  where organization_id = org_id and athlete_no = target_athlete_no;

  insert into public.audit_log (organization_id, actor, entity, action, before, after)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'athlete',
    'athlete.age-corrected',
    jsonb_build_object('athlete_no', target_athlete_no, 'birth_year', previous),
    jsonb_build_object('athlete_no', target_athlete_no, 'birth_year', corrected, 'age', age)
  );

  return array(
    select e.league_id from public.entry e
    where e.organization_id = org_id and e.athlete_no = target_athlete_no
    order by e.league_id
  );
end;
$$;

revoke execute on function public.correct_athlete_age(integer, integer, integer) from public, anon;
grant execute on function public.correct_athlete_age(integer, integer, integer) to authenticated;

-- The results name their League, so a change to one athlete can refresh every
-- League they are entered in without knowing those Leagues' slugs.
create or replace function public.league_results(slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'league_id', l.id,
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
