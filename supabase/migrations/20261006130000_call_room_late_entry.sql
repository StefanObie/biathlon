-- The Call room is often where a missing athlete is found (#68). A Caller
-- can't write entries, so this is the one way they add one: an athlete of
-- the Organization who isn't on the League's Start list becomes a Late entry
-- in the open heat being called, with no swim slot and the age group of
-- their latest entry, and is checked in there. It never creates an athlete
-- or changes or moves an existing entry.
create function public.check_in_late_entry(
  target_league_id integer,
  target_athlete_no integer,
  target_run_heat integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id integer;
  age_group text;
  entered_heat integer;
begin
  if not private.has_league_role(target_league_id, 'caller') then
    raise exception 'Only a Caller of this league can add a Late entry on check-in'
      using errcode = '42501';
  end if;
  if private.heat_is_closed(target_league_id, target_run_heat) then
    raise exception 'Heat % is closed', target_run_heat using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.entry
    where league_id = target_league_id and run_heat = target_run_heat
  ) then
    raise exception 'Heat % has no one on the Start list', target_run_heat
      using errcode = '22023';
  end if;

  select organization_id into org_id
  from public.league where id = target_league_id;
  if not exists (
    select 1 from public.athlete
    where organization_id = org_id and athlete_no = target_athlete_no
  ) then
    raise exception 'Athlete % is not an athlete of this organization', target_athlete_no
      using errcode = '22023';
  end if;

  select run_heat into entered_heat
  from public.entry
  where league_id = target_league_id and athlete_no = target_athlete_no;
  if entered_heat is not null then
    raise exception '#% is already on the Start list in heat %', target_athlete_no, entered_heat
      using errcode = '23505';
  end if;

  select g.age_group_code into age_group
  from public.latest_age_groups(org_id, array[target_athlete_no]) g;
  if age_group is null then
    raise exception '#% has no earlier entry to take an age group from. Ask an Official to add them.', target_athlete_no
      using errcode = '22023';
  end if;

  insert into public.entry (league_id, athlete_no, run_heat, age_group_code)
  values (target_league_id, target_athlete_no, target_run_heat, age_group);

  insert into public.call_room_check_in (league_id, athlete_no, run_heat)
  values (target_league_id, target_athlete_no, target_run_heat);
end;
$$;

revoke execute on function public.check_in_late_entry(integer, integer, integer) from public, anon;
grant execute on function public.check_in_late_entry(integer, integer, integer) to authenticated;
