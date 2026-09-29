-- Signing up creates an Organization (#30): any signed-in user can create
-- one and becomes its only Admin. There are no insert policies on
-- organization or organization_member, so this security definer RPC is the
-- only way in, and it only ever adds the caller to the Organization it
-- just made.
create function public.create_organization(org_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to create an organization' using errcode = '42501';
  end if;
  if coalesce(trim(org_name), '') = '' then
    raise exception 'An organization needs a name' using errcode = '22023';
  end if;

  insert into public.organization (name)
  values (trim(org_name))
  returning id into new_id;

  insert into public.organization_member (organization_id, user_id, is_admin)
  values (new_id, (select auth.uid()), true);

  return new_id;
end;
$$;

revoke execute on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
