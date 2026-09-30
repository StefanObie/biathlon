SET local check_function_bodies = off;

-- Managing Members and Admins (#35). An Admin makes another Member an
-- Admin, demotes an Admin, or removes a Member from the Organization.
-- Nobody writes organization_member directly; the functions below do, and
-- write each change to the Organization's audit log.

-- An Organization never loses its last Admin: the database refuses to
-- demote or remove the only one, however the change is made. A Member
-- going because the Organization itself is being deleted is not a loss.
create function private.keep_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and not (old.is_admin and not new.is_admin) then
    return new;
  end if;
  if not old.is_admin then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE'
    and not exists (select 1 from public.organization where id = old.organization_id)
  then
    return old;
  end if;
  if not exists (
    select 1 from public.organization_member m
    where m.organization_id = old.organization_id
      and m.user_id <> old.user_id
      and m.is_admin
  ) then
    raise exception 'An organization must keep at least one Admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger organization_member_keep_last_admin
  before update or delete on organization_member
  for each row execute function private.keep_last_admin();

-- A removed Member's League team entries are ended, not deleted, so the
-- teams' history survives them. That means a team entry can outlive its
-- membership, so there is no foreign key to organization_member; instead a check
-- runs when an entry is added. It runs after set_organization_from_league
-- (triggers fire in name order) so it sees the entry's Organization.
alter table league_team_member
  drop constraint league_team_member_organization_id_user_id_fkey;

create function private.league_team_member_requires_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_member m
    where m.organization_id = new.organization_id and m.user_id = new.user_id
  ) then
    raise exception 'Only a Member of the organization can be on a league team'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger league_team_member_validate_member
  before insert on league_team_member
  for each row execute function private.league_team_member_requires_member();

-- Makes a Member an Admin, or demotes an Admin back to an ordinary Member.
-- Does nothing if they already are what was asked for. Demoting the last
-- Admin is refused by keep_last_admin.
create function public.set_member_admin(org_id integer, member_user_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.organization_member;
  member_email text;
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin can manage Members' using errcode = '42501';
  end if;

  select * into target
  from public.organization_member m
  where m.organization_id = org_id and m.user_id = member_user_id
  for update;
  if not found then
    raise exception 'No such Member' using errcode = 'P0002';
  end if;
  if target.is_admin = make_admin then
    return;
  end if;

  update public.organization_member
  set is_admin = make_admin
  where organization_id = org_id and user_id = member_user_id;

  select u.email into member_email from auth.users u where u.id = member_user_id;
  insert into public.audit_log (organization_id, actor, entity, action, before, after)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'member',
    case when make_admin then 'member.made-admin' else 'member.demoted' end,
    jsonb_build_object('user_id', member_user_id, 'email', member_email, 'is_admin', target.is_admin),
    jsonb_build_object('user_id', member_user_id, 'email', member_email, 'is_admin', make_admin)
  );
end;
$$;

revoke execute on function public.set_member_admin(integer, uuid, boolean) from public, anon;
grant execute on function public.set_member_admin(integer, uuid, boolean) to authenticated;

-- Removes a Member from the Organization. Their entries on its Default
-- team go, and their entries on its Leagues' teams are ended, so they lose
-- access to every League of the Organization. Removing the last Admin is
-- refused by keep_last_admin.
create function public.remove_member(org_id integer, member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.organization_member;
  member_email text;
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin can manage Members' using errcode = '42501';
  end if;

  select * into target
  from public.organization_member m
  where m.organization_id = org_id and m.user_id = member_user_id
  for update;
  if not found then
    raise exception 'No such Member' using errcode = 'P0002';
  end if;

  update public.league_team_member
  set ended_at = now()
  where organization_id = org_id and user_id = member_user_id and ended_at is null;

  delete from public.default_team_member
  where organization_id = org_id and user_id = member_user_id;

  delete from public.organization_member
  where organization_id = org_id and user_id = member_user_id;

  select u.email into member_email from auth.users u where u.id = member_user_id;
  insert into public.audit_log (organization_id, actor, entity, action, before)
  values (
    org_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'member',
    'member.removed',
    jsonb_build_object('user_id', member_user_id, 'email', member_email, 'is_admin', target.is_admin)
  );
end;
$$;

revoke execute on function public.remove_member(integer, uuid) from public, anon;
grant execute on function public.remove_member(integer, uuid) to authenticated;
