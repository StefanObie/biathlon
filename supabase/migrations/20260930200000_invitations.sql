SET local check_function_bodies = off;

-- Invitations (#34). An Admin invites someone by email to become a Member
-- of their Organization, optionally with one Role on the Default team or on
-- one League's team (league_id null means the Default team). The link in
-- the email carries a secret that is stored only as a hash: nobody can read
-- secret_hash through the API, Admins included, and Admins only see the
-- other columns. Sending, cancelling and accepting all go through the
-- functions below, never direct writes.
--
-- "Open" means neither accepted nor cancelled, expired or not. An email has
-- at most one open Invitation per Organization, and sending again replaces
-- it. A pending Invitation is an open one that hasn't expired.
--
-- league_id has no foreign key: a League that has since gone must not take
-- the Invitation with it, and accepting one skips the team entry instead.
create table invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id integer not null references organization (id),
  email text not null check (email <> '' and email = lower(trim(email))),
  role league_role,
  league_id integer,
  secret_hash text not null,
  invited_by uuid not null,
  invited_by_email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  check (league_id is null or role is not null),
  check (accepted_at is null or cancelled_at is null)
);

alter table invitation enable row level security;

create unique index invitation_open_idx
  on invitation (organization_id, email)
  where accepted_at is null and cancelled_at is null;
create unique index invitation_secret_hash_idx on invitation (secret_hash);

revoke all on invitation from anon, authenticated;
grant select (
  id, organization_id, email, role, league_id, invited_by, invited_by_email,
  created_at, expires_at, accepted_at, cancelled_at
) on invitation to authenticated;

create policy "Admins can read their organizations' invitations"
  on invitation for select
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

-- Sends an Invitation, or replaces the Organization's open one for that
-- email. The caller's app makes the secret and passes only its hash.
create function public.send_invitation(
  org_id integer,
  invitee_email text,
  invitee_role league_role,
  invitee_league_id integer,
  new_secret_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(coalesce(invitee_email, '')));
  sender_email text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
  existing public.invitation;
  invitation_id uuid;
begin
  if not private.is_org_member(org_id, as_admin => true) then
    raise exception 'Only an Admin can invite Members' using errcode = '42501';
  end if;
  if normalized = '' or position('@' in normalized) = 0 then
    raise exception 'An invitation needs an email address' using errcode = '22023';
  end if;
  if coalesce(new_secret_hash, '') = '' then
    raise exception 'An invitation needs a secret' using errcode = '22023';
  end if;
  if invitee_league_id is not null and invitee_role is null then
    raise exception 'A league needs a role' using errcode = '22023';
  end if;
  if invitee_league_id is not null and not exists (
    select 1 from public.league l
    where l.id = invitee_league_id and l.organization_id = org_id
  ) then
    raise exception 'That league does not exist' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.organization_member m
    join auth.users u on u.id = m.user_id
    where m.organization_id = org_id and lower(u.email) = normalized
  ) then
    raise exception '% is already a Member', normalized using errcode = '23505';
  end if;

  select * into existing
  from public.invitation i
  where i.organization_id = org_id
    and i.email = normalized
    and i.accepted_at is null
    and i.cancelled_at is null
  for update;

  if found then
    update public.invitation
    set role = invitee_role,
        league_id = invitee_league_id,
        secret_hash = new_secret_hash,
        invited_by = (select auth.uid()),
        invited_by_email = sender_email,
        created_at = now(),
        expires_at = now() + interval '7 days'
    where id = existing.id
    returning id into invitation_id;

    insert into public.audit_log (organization_id, actor, entity, action, before, after)
    values (
      org_id, sender_email, 'invitation', 'invitation.replaced',
      jsonb_build_object('email', normalized, 'role', existing.role, 'league_id', existing.league_id),
      jsonb_build_object('email', normalized, 'role', invitee_role, 'league_id', invitee_league_id)
    );
  else
    insert into public.invitation (
      organization_id, email, role, league_id, secret_hash, invited_by, invited_by_email
    )
    values (
      org_id, normalized, invitee_role, invitee_league_id, new_secret_hash,
      (select auth.uid()), sender_email
    )
    returning id into invitation_id;

    insert into public.audit_log (organization_id, actor, entity, action, after)
    values (
      org_id, sender_email, 'invitation', 'invitation.sent',
      jsonb_build_object('email', normalized, 'role', invitee_role, 'league_id', invitee_league_id)
    );
  end if;

  return invitation_id;
end;
$$;

revoke execute on function public.send_invitation(integer, text, league_role, integer, text) from public, anon;
grant execute on function public.send_invitation(integer, text, league_role, integer, text) to authenticated;

-- Cancels a pending Invitation. Anything else, including someone else's
-- Organization's, is reported the same way as one that doesn't exist.
create function public.cancel_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invitation;
begin
  select * into target
  from public.invitation i
  where i.id = invitation_id
    and private.is_org_member(i.organization_id, as_admin => true)
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'No such pending invitation' using errcode = 'P0002';
  end if;

  update public.invitation set cancelled_at = now() where id = target.id;

  insert into public.audit_log (organization_id, actor, entity, action, before)
  values (
    target.organization_id,
    coalesce((select auth.jwt() ->> 'email'), 'unknown'),
    'invitation', 'invitation.cancelled',
    jsonb_build_object('email', target.email, 'role', target.role, 'league_id', target.league_id)
  );
end;
$$;

revoke execute on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.cancel_invitation(uuid) to authenticated;

-- Accepts the Invitation behind a link's secret for a user whose email it
-- names: makes them a Member, adds the team entry if any (skipped if the
-- League has since gone), and uses the Invitation up. Only the app's server
-- calls this, with the service role, after it has worked out which user the
-- link's email belongs to; the email check here means it can still only
-- ever accept for the invited email. Returns where the invitee should land.
create function public.accept_invitation(secret_hash_in text, accepting_user uuid)
returns table (
  landing_organization_id integer,
  landing_role league_role,
  landing_league_id integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invitation;
  user_email text;
  applied_league_id integer;
begin
  select * into target
  from public.invitation i
  where i.secret_hash = secret_hash_in
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation can no longer be used' using errcode = 'P0002';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = accepting_user;
  if user_email is distinct from target.email then
    raise exception 'This invitation is for a different email' using errcode = '42501';
  end if;

  update public.invitation set accepted_at = now() where id = target.id;

  insert into public.organization_member (organization_id, user_id)
  values (target.organization_id, accepting_user)
  on conflict do nothing;

  if target.role is not null and target.league_id is null then
    insert into public.default_team_member (organization_id, user_id, role)
    values (target.organization_id, accepting_user, target.role)
    on conflict do nothing;
  elsif target.role is not null and exists (
    select 1 from public.league l
    where l.id = target.league_id and l.organization_id = target.organization_id
  ) then
    insert into public.league_team_member (league_id, user_id, role)
    values (target.league_id, accepting_user, target.role)
    on conflict (league_id, user_id, role) where ended_at is null do nothing;
    applied_league_id := target.league_id;
  end if;

  insert into public.audit_log (organization_id, actor, entity, action, after)
  values (
    target.organization_id, user_email, 'invitation', 'invitation.accepted',
    jsonb_build_object(
      'email', target.email, 'role', target.role, 'league_id', target.league_id,
      'league_team_entry_added', applied_league_id is not null
    )
  );

  return query select
    target.organization_id,
    target.role,
    applied_league_id;
end;
$$;

revoke execute on function public.accept_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid) to service_role;

-- The Organizations that have a pending Invitation for the signed-in
-- user's email, so a user who signs in before following the link isn't sent
-- to create an Organization of their own. Invitations are otherwise
-- readable only by the Organization's Admins.
create function public.my_pending_invitations()
returns table (organization_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.expires_at
  from public.invitation i
  join public.organization o on o.id = i.organization_id
  where i.email = lower((select auth.jwt() ->> 'email'))
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  order by i.expires_at;
$$;

revoke execute on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;
