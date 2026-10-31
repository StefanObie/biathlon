-- A Late entry's age (#83). An Official of the League gives an athlete on its
-- Start list an age, stored as the year of the League date minus it. It fills
-- in an empty birth year and never overwrites one, so a quick race-day entry
-- can't damage stored data.
--
-- Returns the Leagues the athlete is entered in, whose cached results need
-- refreshing, or none when the birth year was left alone. Their ids, not their
-- slugs: an Official may not be on those Leagues, and a Protected League's slug
-- is its secret.
create function public.set_late_entry_age(target_league_id integer, target_athlete_no integer, age integer)
returns integer[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id integer;
  league_year integer;
  estimated integer;
begin
  if not private.has_league_role(target_league_id, 'official') then
    raise exception 'Only an Official of this League can give a Late entry''s age'
      using errcode = '42501';
  end if;
  if age is null or age not between 5 and 100 then
    raise exception 'Age must be between 5 and 100.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.entry e
    where e.league_id = target_league_id and e.athlete_no = target_athlete_no
  ) then
    raise exception '#% is not on the Start list', target_athlete_no
      using errcode = '22023';
  end if;

  select l.organization_id, extract(year from l.league_date)::integer
  into org_id, league_year
  from public.league l
  where l.id = target_league_id;

  estimated := league_year - age;

  update public.athlete a
  set birth_year = estimated
  where a.organization_id = org_id
    and a.athlete_no = target_athlete_no
    and a.birth_year is null;
  if not found then
    return '{}';
  end if;

  insert into public.audit_log (organization_id, actor, entity, action, before, after)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'athlete',
    'athlete.late-entry-age-set',
    jsonb_build_object('athlete_no', target_athlete_no, 'birth_year', null),
    jsonb_build_object(
      'athlete_no', target_athlete_no,
      'birth_year', estimated,
      'age', age,
      'league_id', target_league_id
    )
  );

  return array(
    select e.league_id from public.entry e
    where e.organization_id = org_id and e.athlete_no = target_athlete_no
    order by e.league_id
  );
end;
$$;

revoke execute on function public.set_late_entry_age(integer, integer, integer) from public, anon;
grant execute on function public.set_late_entry_age(integer, integer, integer) to authenticated;
