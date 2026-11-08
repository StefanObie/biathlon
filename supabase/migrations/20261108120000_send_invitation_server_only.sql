-- Only the app's server may send an Invitation.
--
-- send_invitation took the secret's hash from its caller and any signed-in
-- user could call it. Anyone could make an Organization (becoming its
-- Admin), invite another person's email with the hash of a secret they
-- chose, and follow their own link, which signs in as the invited email.
-- Now the browser can't call it: the server works out who is inviting,
-- makes the secret, emails it and passes the inviter in.
--
-- Every open Invitation is cancelled, since any of them may carry a secret
-- chosen by someone other than the invitee. Admins send them again.

drop function public.send_invitation(integer, text, league_role, integer, text);

-- Sends an Invitation on behalf of inviter_id, or replaces the Organization's
-- open one for that email. Only the app's server calls this, with the
-- service role: it makes the secret, emails it and passes only its hash.
-- The browser must never choose the secret, or it could invite any email
-- (another Organization's Admin, say) and follow its own link to sign in
-- as them.
create function public.send_invitation(
  org_id integer,
  invitee_email text,
  invitee_role league_role,
  invitee_league_id integer,
  new_secret_hash text,
  inviter_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(coalesce(invitee_email, '')));
  sender_email text := coalesce((select u.email from auth.users u where u.id = inviter_id), 'unknown');
  existing public.invitation;
  invitation_id uuid;
begin
  if inviter_id is null or not exists (
    select 1 from public.organization_member m
    where m.organization_id = org_id and m.user_id = inviter_id and m.is_admin
  ) then
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
        invited_by = inviter_id,
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
      inviter_id, sender_email
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

revoke execute on function public.send_invitation(integer, text, league_role, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.send_invitation(integer, text, league_role, integer, text, uuid) to service_role;

with cancelled as (
  update public.invitation
  set cancelled_at = now()
  where accepted_at is null and cancelled_at is null
  returning organization_id, email, role, league_id
)
insert into public.audit_log (organization_id, actor, entity, action, before)
select
  organization_id, 'system', 'invitation', 'invitation.cancelled',
  jsonb_build_object('email', email, 'role', role, 'league_id', league_id)
from cancelled;
