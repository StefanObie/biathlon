-- Managing Members and Admins (#35).
--
-- Organization A has two Admins ("admin" and "second admin"), a Member who
-- is on the Default team and a League's team, and a second ordinary Member.
-- Organization B has a single Admin.

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f000a', 'admin@members.test'),
  ('00000000-0000-0000-0000-0000000f000c', 'second-admin@members.test'),
  ('00000000-0000-0000-0000-0000000f00a1', 'member@members.test'),
  ('00000000-0000-0000-0000-0000000f00a2', 'other@members.test'),
  ('00000000-0000-0000-0000-0000000f000b', 'admin-b@members.test');

insert into organization (id, name) overriding system value values
  (911, 'Organization A'),
  (912, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (911, '00000000-0000-0000-0000-0000000f000a', true),
  (911, '00000000-0000-0000-0000-0000000f000c', true),
  (911, '00000000-0000-0000-0000-0000000f00a1', false),
  (911, '00000000-0000-0000-0000-0000000f00a2', false),
  (912, '00000000-0000-0000-0000-0000000f000b', true);

insert into league (id, organization_id, name, league_date, season) overriding system value values
  (9911, 911, 'League A', '2026-10-01', 2026),
  (9912, 911, 'League A2', '2026-10-08', 2026);

insert into default_team_member (organization_id, user_id, role) values
  (911, '00000000-0000-0000-0000-0000000f00a1', 'placer');
insert into league_team_member (league_id, user_id, role) values
  (9911, '00000000-0000-0000-0000-0000000f00a1', 'timekeeper'),
  (9912, '00000000-0000-0000-0000-0000000f00a1', 'caller');

---------------------------------------------------------------------------
-- Only an Admin of the Organization manages its Members.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f00a2", "role": "authenticated", "email": "other@members.test"}';

select throws_ok(
  $$ select public.set_member_admin(911, '00000000-0000-0000-0000-0000000f00a1', true) $$,
  '42501', 'Only an Admin can manage Members',
  'an ordinary Member cannot make anyone an Admin'
);
select throws_ok(
  $$ select public.remove_member(911, '00000000-0000-0000-0000-0000000f00a1') $$,
  '42501', 'Only an Admin can manage Members',
  'an ordinary Member cannot remove anyone'
);
update organization_member set is_admin = true
  where user_id = '00000000-0000-0000-0000-0000000f00a2';
select is(
  (select is_admin from organization_member
    where user_id = '00000000-0000-0000-0000-0000000f00a2'),
  false, 'nobody can write memberships directly'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f000b", "role": "authenticated", "email": "admin-b@members.test"}';

select throws_ok(
  $$ select public.remove_member(911, '00000000-0000-0000-0000-0000000f00a1') $$,
  '42501', 'Only an Admin can manage Members',
  'another Organization''s Admin cannot remove its Members'
);

---------------------------------------------------------------------------
-- An Admin makes a Member an Admin, and demotes one.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f000a", "role": "authenticated", "email": "admin@members.test"}';

select lives_ok(
  $$ select public.set_member_admin(911, '00000000-0000-0000-0000-0000000f00a2', true) $$,
  'an Admin can make a Member an Admin'
);
select is(
  (select is_admin from organization_member
    where organization_id = 911 and user_id = '00000000-0000-0000-0000-0000000f00a2'),
  true, 'the Member is now an Admin'
);
select lives_ok(
  $$ select public.set_member_admin(911, '00000000-0000-0000-0000-0000000f00a2', false) $$,
  'an Admin can demote an Admin'
);
select is(
  (select is_admin from organization_member
    where organization_id = 911 and user_id = '00000000-0000-0000-0000-0000000f00a2'),
  false, 'the Admin is an ordinary Member again'
);
select throws_ok(
  $$ select public.set_member_admin(911, '00000000-0000-0000-0000-0000000f000b', true) $$,
  'P0002', 'No such Member',
  'a user outside the Organization can''t be made an Admin of it'
);

select results_eq(
  $$ select action from audit_log
      where organization_id = 911 and entity = 'member' order by at, action $$,
  $$ values ('member.demoted'), ('member.made-admin') $$,
  'making an Admin and demoting one are both in the audit log'
);

---------------------------------------------------------------------------
-- The last Admin can't be demoted or removed.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f000b", "role": "authenticated", "email": "admin-b@members.test"}';

select throws_ok(
  $$ select public.set_member_admin(912, '00000000-0000-0000-0000-0000000f000b', false) $$,
  '23514', 'An organization must keep at least one Admin',
  'the last Admin cannot be demoted'
);
select throws_ok(
  $$ select public.remove_member(912, '00000000-0000-0000-0000-0000000f000b') $$,
  '23514', 'An organization must keep at least one Admin',
  'the last Admin cannot be removed'
);

reset role;

select throws_ok(
  $$ update organization_member set is_admin = false where organization_id = 912 $$,
  '23514', 'An organization must keep at least one Admin',
  'the last Admin cannot be demoted by a direct write either'
);
select throws_ok(
  $$ delete from organization_member where organization_id = 912 $$,
  '23514', 'An organization must keep at least one Admin',
  'the last Admin cannot be deleted by a direct write either'
);

-- With two Admins, one can go.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f000a", "role": "authenticated", "email": "admin@members.test"}';

select lives_ok(
  $$ select public.set_member_admin(911, '00000000-0000-0000-0000-0000000f000c', false) $$,
  'an Admin can be demoted while another remains'
);
select throws_ok(
  $$ select public.set_member_admin(911, '00000000-0000-0000-0000-0000000f000a', false) $$,
  '23514', 'An organization must keep at least one Admin',
  'an Admin demoting themselves as the last one is refused'
);

---------------------------------------------------------------------------
-- A removed Member loses access to every League of the Organization.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f00a1", "role": "authenticated", "email": "member@members.test"}';
select is(
  (select count(*) from league where organization_id = 911), 2::bigint,
  'before removal the Member sees both Leagues'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f000a", "role": "authenticated", "email": "admin@members.test"}';
select lives_ok(
  $$ select public.remove_member(911, '00000000-0000-0000-0000-0000000f00a1') $$,
  'an Admin can remove a Member'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000f00a1", "role": "authenticated", "email": "member@members.test"}';
select is(
  (select count(*) from league where organization_id = 911), 0::bigint,
  'afterwards they see no League of the Organization'
);
select is(
  (select count(*) from organization where id = 911), 0::bigint,
  'and no longer see the Organization'
);

reset role;
select is(
  (select count(*) from league_team_member
    where user_id = '00000000-0000-0000-0000-0000000f00a1' and ended_at is null),
  0::bigint, 'their League team entries are ended'
);
select is(
  (select count(*) from default_team_member
    where user_id = '00000000-0000-0000-0000-0000000f00a1'),
  0::bigint, 'and their Default team entries are gone'
);
select is(
  (select count(*) from audit_log
    where organization_id = 911 and action = 'member.removed'
      and before ->> 'email' = 'member@members.test'),
  1::bigint, 'the removal is in the audit log'
);

select * from finish();
rollback;
