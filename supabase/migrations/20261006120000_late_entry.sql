-- A Late entry's swim slot can stay unknown (#65), but never half known:
-- swim heat and swim lane are both set or both empty.
alter table public.entry alter column swim_heat drop not null;
alter table public.entry alter column swim_lane drop not null;
alter table public.entry add constraint entry_swim_slot_check
  check ((swim_heat is null) = (swim_lane is null));

-- Each of these athletes' age group from their latest entry in the
-- Organization: the League with the latest date, the newest League winning a
-- tie. A Late entry pre-fills its age group from it (#65). An Official may not
-- be on the team of the League that entry is in, so this is security definer
-- and, like reading the athletes themselves, needs a Role in the Organization.
create function public.latest_age_groups(org_id integer, athlete_nos integer[])
returns table (athlete_no integer, age_group_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (e.athlete_no) e.athlete_no, e.age_group_code
  from public.entry e
  join public.league l on l.id = e.league_id
  where e.organization_id = org_id
    and e.athlete_no = any (athlete_nos)
    and private.has_org_role(org_id)
  order by e.athlete_no, l.league_date desc, l.id desc;
$$;

revoke execute on function public.latest_age_groups(integer, integer[]) from public, anon;
grant execute on function public.latest_age_groups(integer, integer[]) to authenticated;
