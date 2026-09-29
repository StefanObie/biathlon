-- The Default team is copied onto new Leagues (#33).
--
-- Organization A has an Admin, an Official, a Timekeeper and one more
-- Member on no team. Organization B has its own Admin. Each block below
-- acts as one of them.

begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'org-admin@default.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'official@default.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'timekeeper@default.test'),
  ('00000000-0000-0000-0000-000000000099', 'bystander@default.test'),
  ('00000000-0000-0000-0000-00000000000b', 'other-admin@default.test');

insert into organization (id, name) overriding system value values
  (901, 'Organization A'),
  (902, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (901, '00000000-0000-0000-0000-00000000000a', true),
  (901, '00000000-0000-0000-0000-0000000000f1', false),
  (901, '00000000-0000-0000-0000-0000000000e1', false),
  (901, '00000000-0000-0000-0000-000000000099', false),
  (902, '00000000-0000-0000-0000-00000000000b', true);

set local role authenticated;

---------------------------------------------------------------------------
-- An Admin manages the Default team.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@default.test"}';

select lives_ok(
  $$ insert into default_team_member (organization_id, user_id, role) values
       (901, '00000000-0000-0000-0000-0000000000f1', 'official'),
       (901, '00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
       (901, '00000000-0000-0000-0000-0000000000e1', 'placer') $$,
  'an Admin adds Members to the Default team'
);
select results_eq(
  $$ select user_id::text, role::text from default_team_member where organization_id = 901 order by user_id, role $$,
  $$ values
       ('00000000-0000-0000-0000-0000000000e1', 'placer'),
       ('00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
       ('00000000-0000-0000-0000-0000000000f1', 'official') $$,
  'an Admin reads the Default team'
);
select results_eq(
  $$ delete from default_team_member where organization_id = 901 and user_id = '00000000-0000-0000-0000-0000000000e1' and role = 'placer' returning role::text $$,
  $$ values ('placer') $$,
  'an Admin takes a Role off the Default team'
);
select throws_ok(
  $$ insert into default_team_member (organization_id, user_id, role) values (901, '00000000-0000-0000-0000-00000000000b', 'placer') $$,
  '23503', null, 'only Members of the Organization can be on its Default team'
);
select throws_ok(
  $$ insert into default_team_member (organization_id, user_id, role) values (902, '00000000-0000-0000-0000-00000000000b', 'placer') $$,
  '42501', null, 'an Admin can''t change another Organization''s Default team'
);
select results_eq(
  $$ select action, coalesce(after, before) ->> 'role', coalesce(after, before) ->> 'email', organization_id, league_id
     from audit_log where entity = 'default_team' order by at, action, coalesce(after, before) ->> 'role' $$,
  $$ values
       ('add-role', 'official', 'official@default.test', 901, null::integer),
       ('add-role', 'placer', 'timekeeper@default.test', 901, null::integer),
       ('add-role', 'timekeeper', 'timekeeper@default.test', 901, null::integer),
       ('remove-role', 'placer', 'timekeeper@default.test', 901, null::integer) $$,
  'Default team changes are written to the audit log'
);
select results_eq(
  $$ select distinct actor from audit_log where entity = 'default_team' $$,
  $$ values ('org-admin@default.test') $$,
  'the audit log names the Admin who changed the Default team'
);

---------------------------------------------------------------------------
-- Only Admins see or change the Default team.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@default.test"}';
select is_empty($$ select 1 from default_team_member $$, 'a Member who isn''t an Admin can''t read the Default team');
select is_empty($$ select 1 from audit_log $$, 'a Member who isn''t an Admin can''t read Default team changes');
select throws_ok(
  $$ insert into default_team_member (organization_id, user_id, role) values (901, '00000000-0000-0000-0000-000000000099', 'placer') $$,
  '42501', null, 'a Member who isn''t an Admin can''t add to the Default team'
);
select results_eq(
  $$ with d as (delete from default_team_member returning 1) select count(*)::int from d $$,
  $$ values (0) $$,
  'a Member who isn''t an Admin can''t take anyone off the Default team'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated", "email": "other-admin@default.test"}';
select is_empty($$ select 1 from default_team_member $$, 'another Organization''s Admin can''t read the Default team');
select is_empty($$ select 1 from audit_log $$, 'another Organization''s Admin can''t read its Default team changes');

---------------------------------------------------------------------------
-- Creating a League copies the Default team onto its League team.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@default.test"}';

select lives_ok(
  $$ insert into league (id, name, league_date, season, organization_id) overriding system value values
       (901, 'League 1', '2026-01-01', 2026, 901) $$,
  'an Admin creates League 1'
);
select results_eq(
  $$ select user_id::text, role::text from league_team_member where league_id = 901 and ended_at is null order by user_id, role $$,
  $$ values
       ('00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
       ('00000000-0000-0000-0000-0000000000f1', 'official') $$,
  'League 1''s team starts as a copy of the Default team'
);
select results_eq(
  $$ select action, after ->> 'role' from audit_log where entity = 'league_team' and league_id = 901 order by after ->> 'role' $$,
  $$ values ('add-role', 'official'), ('add-role', 'timekeeper') $$,
  'the copied League team is written to League 1''s audit log'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "email": "timekeeper@default.test"}';
select ok(private.has_league_role(901, 'timekeeper'), 'a Timekeeper on the Default team is a Timekeeper on League 1');

---------------------------------------------------------------------------
-- Later Default team changes don't reach League 1.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@default.test"}';

insert into default_team_member (organization_id, user_id, role) values
  (901, '00000000-0000-0000-0000-000000000099', 'placer');
delete from default_team_member
where organization_id = 901 and user_id = '00000000-0000-0000-0000-0000000000e1';

select results_eq(
  $$ select user_id::text, role::text from league_team_member where league_id = 901 and ended_at is null order by user_id, role $$,
  $$ values
       ('00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
       ('00000000-0000-0000-0000-0000000000f1', 'official') $$,
  'changing the Default team leaves League 1''s team as it was'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "bystander@default.test"}';
select is_empty($$ select 1 from league $$, 'a Placer added to the Default team later can''t see League 1');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "email": "timekeeper@default.test"}';
select ok(private.has_league_role(901, 'timekeeper'), 'a Timekeeper taken off the Default team is still a Timekeeper on League 1');

---------------------------------------------------------------------------
-- A League created after the change gets the Default team as it is now.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@default.test"}';

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (902, 'League 2', '2026-02-01', 2026, 901);

select results_eq(
  $$ select user_id::text, role::text from league_team_member where league_id = 902 and ended_at is null order by user_id, role $$,
  $$ values
       ('00000000-0000-0000-0000-000000000099', 'placer'),
       ('00000000-0000-0000-0000-0000000000f1', 'official') $$,
  'League 2''s team is a copy of the Default team as it is when League 2 is created'
);

---------------------------------------------------------------------------
-- Changing a League's team doesn't change the Default team.
---------------------------------------------------------------------------

insert into league_team_member (league_id, user_id, role) values
  (902, '00000000-0000-0000-0000-0000000000e1', 'timekeeper');
update league_team_member set ended_at = now()
where league_id = 902 and user_id = '00000000-0000-0000-0000-0000000000f1' and ended_at is null;

select results_eq(
  $$ select user_id::text, role::text from default_team_member where organization_id = 901 order by user_id, role $$,
  $$ values
       ('00000000-0000-0000-0000-000000000099', 'placer'),
       ('00000000-0000-0000-0000-0000000000f1', 'official') $$,
  'changing League 2''s team leaves the Default team as it was'
);
select results_eq(
  $$ select user_id::text, role::text from league_team_member where league_id = 901 and ended_at is null order by user_id, role $$,
  $$ values
       ('00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
       ('00000000-0000-0000-0000-0000000000f1', 'official') $$,
  'changing League 2''s team leaves League 1''s team as it was'
);

---------------------------------------------------------------------------
-- An Organization with no Default team starts its Leagues with no team.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated", "email": "other-admin@default.test"}';

select lives_ok(
  $$ insert into league (id, name, league_date, season, organization_id) overriding system value values
       (903, 'League B', '2026-01-01', 2026, 902) $$,
  'an Admin with an empty Default team creates a League'
);
select is_empty(
  $$ select 1 from league_team_member where league_id = 903 $$,
  'that League starts with an empty team'
);
select is_empty(
  $$ select 1 from league_team_member where league_id in (901, 902) $$,
  'another Organization''s Admin can''t read Organization A''s League teams'
);

reset role;

select is(
  (select count(*)::int from league_team_member where league_id = 903),
  0,
  'Organization A''s Default team isn''t copied onto Organization B''s League'
);
select throws_ok(
  $$ insert into audit_log (actor, entity, action) values ('someone', 'default_team', 'add-role') $$,
  '23514', null, 'an audit row belongs to a League or an Organization'
);

select * from finish();
rollback;
