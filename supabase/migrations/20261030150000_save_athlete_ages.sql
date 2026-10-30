-- Uploading the age file (#82). An Admin saves birth years for the athletes the
-- file names, matched by athlete number. Nothing else on the athlete changes,
-- an unknown number is left out rather than created, and the one audit row
-- holds counts: no athlete's details.
create function public.save_athlete_ages(org_id integer, year_taken integer, ages jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
  submitted integer := jsonb_array_length(ages);
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin of the Organization can upload ages'
      using errcode = '42501';
  end if;
  if year_taken > extract(year from now()) then
    raise exception 'The year the ages were taken can''t be in the future'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(ages) as a (athlete_no integer, birth_year integer)
    where a.birth_year is null or year_taken - a.birth_year not between 5 and 100
  ) then
    raise exception 'An age must be between 5 and 100' using errcode = '22023';
  end if;

  update public.athlete t
  set birth_year = a.birth_year
  from jsonb_to_recordset(ages) as a (athlete_no integer, birth_year integer)
  where t.organization_id = org_id and t.athlete_no = a.athlete_no;
  get diagnostics updated = row_count;

  insert into public.audit_log (organization_id, actor, entity, action, after)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'athlete',
    'athlete.ages-uploaded',
    jsonb_build_object(
      'year_taken', year_taken,
      'rows', submitted,
      'updated', updated,
      'unknown', submitted - updated
    )
  );

  return updated;
end;
$$;

revoke execute on function public.save_athlete_ages(integer, integer, jsonb) from public, anon;
grant execute on function public.save_athlete_ages(integer, integer, jsonb) to authenticated;
