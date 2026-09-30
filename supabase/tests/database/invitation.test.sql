-- Invitations (#34).
--
-- Organization A has an Admin, an ordinary Member and a League. Organization
-- B has its own Admin. "invitee" has an account but no Membership; "new
-- hire" is added to Organization A by an accepted Invitation.

begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e000a', 'admin-a@invite.test'),
  ('00000000-0000-0000-0000-0000000e000b', 'admin-b@invite.test'),
  ('00000000-0000-0000-0000-0000000e00a1', 'member@invite.test'),
  ('00000000-0000-0000-0000-0000000e00c1', 'Invitee@Invite.Test'),
  ('00000000-0000-0000-0000-0000000e00c2', 'stranger@invite.test'),
  ('00000000-0000-0000-0000-0000000e00c3', 'gone@invite.test'),
  ('00000000-0000-0000-0000-0000000e00c4', 'late@invite.test');

insert into organization (id, name) overriding system value values
  (901, 'Organization A'),
  (902, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (901, '00000000-0000-0000-0000-0000000e000a', true),
  (901, '00000000-0000-0000-0000-0000000e00a1', false),
  (902, '00000000-0000-0000-0000-0000000e000b', true);

insert into league (id, organization_id, name, league_date, season) overriding system value values
  (9901, 901, 'League A', '2026-10-01', 2026),
  (9902, 902, 'League B', '2026-10-01', 2026);

---------------------------------------------------------------------------
-- Non-Admins can't invite, and can't read Invitations.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e00a1", "role": "authenticated", "email": "member@invite.test"}';

select throws_ok(
  $$ select public.send_invitation(901, 'x@invite.test', null, null, 'hash-member') $$,
  '42501', 'Only an Admin can invite Members',
  'an ordinary Member cannot send an Invitation'
);
select throws_ok(
  $$ insert into invitation (organization_id, email, secret_hash, invited_by, invited_by_email)
       values (901, 'x@invite.test', 'hash-direct', '00000000-0000-0000-0000-0000000e00a1', 'member@invite.test') $$,
  '42501', null,
  'nobody can insert an Invitation directly'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e000b", "role": "authenticated", "email": "admin-b@invite.test"}';

select throws_ok(
  $$ select public.send_invitation(901, 'x@invite.test', null, null, 'hash-other-org') $$,
  '42501', 'Only an Admin can invite Members',
  'another Organization''s Admin cannot send an Invitation for it'
);

---------------------------------------------------------------------------
-- An Admin sends, replaces and cancels Invitations.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e000a", "role": "authenticated", "email": "admin-a@invite.test"}';

select lives_ok(
  $$ select public.send_invitation(901, '  Invitee@Invite.Test ', 'caller', 9901, 'hash-1') $$,
  'an Admin invites someone with a Role on a League'
);
select results_eq(
  $$ select email, role::text, league_id, invited_by_email from invitation where organization_id = 901 $$,
  $$ values ('invitee@invite.test', 'caller', 9901, 'admin-a@invite.test') $$,
  'the email is normalized and the sender recorded'
);
select ok(
  (select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
     from invitation where organization_id = 901),
  'an Invitation lasts 7 days'
);
select throws_ok(
  $$ select secret_hash from invitation $$,
  '42501', null,
  'the secret hash cannot be read, even by an Admin'
);

select lives_ok(
  $$ select public.send_invitation(901, 'invitee@invite.test', 'official', null, 'hash-2') $$,
  'sending again to the same email replaces the open Invitation'
);
select results_eq(
  $$ select count(*)::int, min(role::text), min(league_id) from invitation where organization_id = 901 $$,
  $$ values (1, 'official', null::integer) $$,
  'there is still one open Invitation, now with the new Role'
);

select throws_ok(
  $$ select public.send_invitation(901, 'member@invite.test', null, null, 'hash-3') $$,
  '23505', 'member@invite.test is already a Member',
  'inviting an existing Member is refused'
);
select throws_ok(
  $$ select public.send_invitation(901, 'y@invite.test', 'placer', 9902, 'hash-4') $$,
  '22023', 'That league does not exist',
  'a League from another Organization cannot be named'
);
select throws_ok(
  $$ select public.send_invitation(901, 'y@invite.test', 'placer', 999999, 'hash-5') $$,
  '22023', 'That league does not exist',
  'the League must exist when sent'
);
select throws_ok(
  $$ insert into invitation (organization_id, email, secret_hash, invited_by, invited_by_email)
       values (901, 'invitee@invite.test', 'hash-dup', '00000000-0000-0000-0000-0000000e000a', 'admin-a@invite.test') $$,
  '42501', null,
  'an Admin cannot write Invitations directly either'
);

reset role;
select throws_ok(
  $$ insert into invitation (organization_id, email, secret_hash, invited_by, invited_by_email)
       values (901, 'invitee@invite.test', 'hash-dup', '00000000-0000-0000-0000-0000000e000a', 'admin-a@invite.test') $$,
  '23505', null,
  'an email has at most one open Invitation per Organization'
);
set local role authenticated;

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e000b", "role": "authenticated", "email": "admin-b@invite.test"}';
select lives_ok(
  $$ select public.send_invitation(902, 'invitee@invite.test', null, null, 'hash-b') $$,
  'the same email can be invited to a different Organization'
);
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e000a", "role": "authenticated", "email": "admin-a@invite.test"}';

---------------------------------------------------------------------------
-- Cancelling.
---------------------------------------------------------------------------

select lives_ok(
  $$ select public.send_invitation(901, 'cancel-me@invite.test', null, null, 'hash-cancel') $$,
  'an Admin sends another Invitation'
);
select lives_ok(
  $$ select public.cancel_invitation((select id from invitation where email = 'cancel-me@invite.test')) $$,
  'an Admin cancels a pending Invitation'
);
select throws_ok(
  $$ select public.cancel_invitation((select id from invitation where email = 'cancel-me@invite.test')) $$,
  'P0002', 'No such pending invitation',
  'cancelling only applies to pending Invitations'
);

reset role;

select throws_ok(
  $$ select public.accept_invitation('hash-cancel', '00000000-0000-0000-0000-0000000e00c2') $$,
  'P0002', 'This invitation can no longer be used',
  'a cancelled Invitation cannot be accepted'
);

select results_eq(
  $$ select action from audit_log where organization_id = 901 and entity = 'invitation' order by action $$,
  $$ values ('invitation.cancelled'), ('invitation.replaced'), ('invitation.sent'), ('invitation.sent') $$,
  'sending, replacing and cancelling are audited'
);
select is(
  (select count(*)::int from audit_log where after::text like '%hash-%' or before::text like '%hash-%'),
  0,
  'the audit log never holds the secret'
);

---------------------------------------------------------------------------
-- The invitee's own view.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e00c1", "role": "authenticated", "email": "Invitee@Invite.Test"}';

select results_eq(
  $$ select organization_name from public.my_pending_invitations() order by 1 $$,
  $$ values ('Organization A'), ('Organization B') $$,
  'an invitee sees which Organizations have a pending Invitation for them'
);
select is_empty(
  $$ select 1 from invitation $$,
  'an invitee cannot read Invitations'
);
select throws_ok(
  $$ select public.accept_invitation('hash-2', '00000000-0000-0000-0000-0000000e00c1') $$,
  '42501', null,
  'the browser cannot accept an Invitation, even its own'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000e00c2", "role": "authenticated", "email": "stranger@invite.test"}';
select is_empty(
  $$ select 1 from public.my_pending_invitations() $$,
  'someone else has no pending Invitations'
);

---------------------------------------------------------------------------
-- Accepting.
---------------------------------------------------------------------------

reset role;
set local role service_role;

select throws_ok(
  $$ select public.accept_invitation('hash-2', '00000000-0000-0000-0000-0000000e00c2') $$,
  '42501', 'This invitation is for a different email',
  'an Invitation can only be accepted by the invited email'
);
select throws_ok(
  $$ select public.accept_invitation('not-a-real-hash', '00000000-0000-0000-0000-0000000e00c1') $$,
  'P0002', 'This invitation can no longer be used',
  'an unknown secret is refused'
);

select results_eq(
  $$ select landing_organization_id, landing_role::text, landing_league_id from public.accept_invitation('hash-2', '00000000-0000-0000-0000-0000000e00c1') $$,
  $$ values (901, 'official', null::integer) $$,
  'accepting returns where the invitee lands'
);
select results_eq(
  $$ select organization_id, is_admin from organization_member where user_id = '00000000-0000-0000-0000-0000000e00c1' $$,
  $$ values (901, false) $$,
  'accepting makes the invitee a Member, not an Admin'
);
select results_eq(
  $$ select role::text from default_team_member where organization_id = 901 and user_id = '00000000-0000-0000-0000-0000000e00c1' $$,
  $$ values ('official') $$,
  'a Default team Role is added'
);
select throws_ok(
  $$ select public.accept_invitation('hash-2', '00000000-0000-0000-0000-0000000e00c1') $$,
  'P0002', 'This invitation can no longer be used',
  'an Invitation works once'
);

-- An existing user keeps their other Organizations.
select lives_ok(
  $$ select public.accept_invitation('hash-b', '00000000-0000-0000-0000-0000000e00c1') $$,
  'the same user accepts an Invitation from another Organization'
);
select results_eq(
  $$ select organization_id from organization_member where user_id = '00000000-0000-0000-0000-0000000e00c1' order by 1 $$,
  $$ values (901), (902) $$,
  'they keep their other Organizations'
);

-- A Role on a League's team, a League that has since gone, and expiry.
insert into invitation (organization_id, email, role, league_id, secret_hash, invited_by, invited_by_email, expires_at) values
  (901, 'stranger@invite.test', 'caller', 9901, 'hash-league', '00000000-0000-0000-0000-0000000e000a', 'admin-a@invite.test', now() + interval '1 day'),
  (901, 'gone@invite.test', 'placer', 999999, 'hash-gone', '00000000-0000-0000-0000-0000000e000a', 'admin-a@invite.test', now() + interval '1 day'),
  (901, 'late@invite.test', null, null, 'hash-late', '00000000-0000-0000-0000-0000000e000a', 'admin-a@invite.test', now() - interval '1 minute');

set local role service_role;

select results_eq(
  $$ select landing_organization_id, landing_role::text, landing_league_id from public.accept_invitation('hash-league', '00000000-0000-0000-0000-0000000e00c2') $$,
  $$ values (901, 'caller', 9901) $$,
  'a League Role lands on that League'
);
select results_eq(
  $$ select league_id, role::text from league_team_member where user_id = '00000000-0000-0000-0000-0000000e00c2' and ended_at is null $$,
  $$ values (9901, 'caller') $$,
  'the League team entry is added'
);
select results_eq(
  $$ select landing_organization_id, landing_role::text, landing_league_id from public.accept_invitation('hash-gone', '00000000-0000-0000-0000-0000000e00c3') $$,
  $$ values (901, 'placer', null::integer) $$,
  'a League that has since gone is skipped and the invitee lands on the Organization'
);
select is(
  (select count(*)::int from organization_member where user_id = '00000000-0000-0000-0000-0000000e00c3' and organization_id = 901),
  1,
  'the invitee is still made a Member'
);
select throws_ok(
  $$ select public.accept_invitation('hash-late', '00000000-0000-0000-0000-0000000e00c4') $$,
  'P0002', 'This invitation can no longer be used',
  'an expired Invitation cannot be accepted'
);

reset role;
select is(
  (select count(*)::int from audit_log where organization_id = 901 and action = 'invitation.accepted'),
  3,
  'accepting is audited'
);

select * from finish();
rollback;
