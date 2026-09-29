-- The Caller Role (#40). Official covers Caller as it covers Timekeeper and
-- Placer, and Admin covers it through the Organization. Until the Call room
-- screen arrives a Caller can only read what any team Member can read.
--
-- Organization A runs League 1. On its team are a Caller, an Official, a
-- Timekeeper and a Placer; its Admin is on no team, and one more Member is
-- on no team at all.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Official covers Caller; Timekeeper and Placer don't; Caller covers only
-- itself.
select ok(private.role_covers('official', 'caller'), 'Official covers Caller');
select ok(private.role_covers('caller', 'caller'), 'Caller covers Caller');
select ok(not private.role_covers('timekeeper', 'caller'), 'Timekeeper doesn''t cover Caller');
select ok(not private.role_covers('placer', 'caller'), 'Placer doesn''t cover Caller');
select ok(not private.role_covers('caller', 'timekeeper'), 'Caller doesn''t cover Timekeeper');
select ok(not private.role_covers('caller', 'placer'), 'Caller doesn''t cover Placer');
select ok(not private.role_covers('caller', 'official'), 'Caller doesn''t cover Official');

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'org-admin@caller.test'),
  ('00000000-0000-0000-0000-0000000000ca', 'caller@caller.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'official@caller.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'timekeeper@caller.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'placer@caller.test'),
  ('00000000-0000-0000-0000-000000000099', 'bystander@caller.test');

insert into organization (id, name) overriding system value values
  (901, 'Organization A');

insert into organization_member (organization_id, user_id, is_admin) values
  (901, '00000000-0000-0000-0000-00000000000a', true),
  (901, '00000000-0000-0000-0000-0000000000ca', false),
  (901, '00000000-0000-0000-0000-0000000000f1', false),
  (901, '00000000-0000-0000-0000-0000000000e1', false),
  (901, '00000000-0000-0000-0000-0000000000d1', false),
  (901, '00000000-0000-0000-0000-000000000099', false);

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (901, 'League 1', '2026-01-01', 2026, 901);

insert into league_team_member (league_id, user_id, role) values
  (901, '00000000-0000-0000-0000-0000000000ca', 'caller'),
  (901, '00000000-0000-0000-0000-0000000000f1', 'official'),
  (901, '00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
  (901, '00000000-0000-0000-0000-0000000000d1', 'placer');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (901, 7, 'Test Athlete', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (901, 7, 1, 1, 1, 'U13');

insert into league_race (league_id, run_heat, started_at, device_id) values
  (901, 1, now(), 'dev');

insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values
  ('tc-1', 901, 1, 1, '05:00.00', 'dev', now());

insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values
  ('pc-1', 901, 1, 1, 7, 'dev', now());

insert into run_result (league_id, athlete_no, run_heat, run_time, source) values
  (901, 7, 1, '05:00.00', 'auto');

insert into audit_log (league_id, actor, entity, action) values
  (901, 'someone', 'league_race', 'close');

set local role authenticated;

---------------------------------------------------------------------------
-- Who holds Caller on League 1.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated", "email": "caller@caller.test"}';
select ok(private.has_league_role(901, 'caller'), 'a Caller holds Caller');
select ok(not private.has_league_role(901, 'timekeeper'), 'a Caller doesn''t hold Timekeeper');
select ok(not private.has_league_role(901, 'placer'), 'a Caller doesn''t hold Placer');
select ok(not private.has_league_role(901, 'official'), 'a Caller doesn''t hold Official');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@caller.test"}';
select ok(private.has_league_role(901, 'caller'), 'an Official holds Caller');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@caller.test"}';
select ok(private.has_league_role(901, 'caller'), 'an Admin holds Caller without being on the team');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "email": "timekeeper@caller.test"}';
select ok(not private.has_league_role(901, 'caller'), 'a Timekeeper doesn''t hold Caller');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated", "email": "placer@caller.test"}';
select ok(not private.has_league_role(901, 'caller'), 'a Placer doesn''t hold Caller');

---------------------------------------------------------------------------
-- A Caller reads what any team Member reads, and writes nothing.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated", "email": "caller@caller.test"}';

select results_eq($$ select id from league $$, $$ values (901) $$, 'a Caller sees the league they''re on');
select isnt_empty($$ select 1 from entry where league_id = 901 $$, 'a Caller reads the heat list');
select isnt_empty($$ select 1 from athlete $$, 'a Caller reads the organization''s athletes');
select isnt_empty($$ select 1 from league_race where league_id = 901 $$, 'a Caller reads heat starts');
select isnt_empty($$ select 1 from league_team_member where league_id = 901 $$, 'a Caller reads the league''s team');
select is_empty($$ select 1 from run_result $$, 'a Caller can''t read run results');
select is_empty($$ select 1 from audit_log $$, 'a Caller can''t read the audit log');
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-ca', 901, 1, 2, '05:01.00', 'dev', now()) $$,
  '42501', null, 'a Caller can''t add a time capture'
);
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-ca', 901, 1, 2, null, 'dev', now()) $$,
  '42501', null, 'a Caller can''t add a position capture'
);
select throws_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values ('on-ca', 901, 1, 0, 'position', 'note', 'dev', now()) $$,
  '42501', null, 'a Caller can''t add an operator note'
);
select throws_ok(
  $$ insert into league_race (league_id, run_heat, started_at, device_id) values (901, 2, now(), 'dev') $$,
  '42501', null, 'a Caller can''t start a heat'
);
select throws_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values (901, 8, 1, 1, 2, 'U13') $$,
  '42501', null, 'a Caller can''t import entries'
);
select throws_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (901, 7, 2, '05:00.00', 'manual') $$,
  '42501', null, 'a Caller can''t write run results'
);
select throws_ok(
  $$ insert into league_team_member (league_id, user_id, role) values (901, '00000000-0000-0000-0000-000000000099', 'caller') $$,
  '42501', null, 'a Caller can''t change the team'
);

---------------------------------------------------------------------------
-- An Admin gives Caller and takes it away.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@caller.test"}';

select lives_ok(
  $$ insert into league_team_member (league_id, user_id, role) values (901, '00000000-0000-0000-0000-000000000099', 'caller') $$,
  'an Admin makes a Member a Caller'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "bystander@caller.test"}';
select results_eq($$ select id from league $$, $$ values (901) $$, 'a new Caller sees the league');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@caller.test"}';
select results_eq(
  $$ update league_team_member set ended_at = now() where league_id = 901 and user_id = '00000000-0000-0000-0000-000000000099' and role = 'caller' and ended_at is null returning role::text $$,
  $$ values ('caller') $$,
  'an Admin removes Caller by ending it'
);
select results_eq(
  $$ select action, coalesce(after, before) ->> 'role' from audit_log where entity = 'league_team' and actor = 'org-admin@caller.test' order by at, action $$,
  $$ values ('add-role', 'caller'), ('remove-role', 'caller') $$,
  'Caller changes are written to the audit log'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "bystander@caller.test"}';
select is_empty($$ select 1 from league $$, 'a removed Caller no longer sees the league');

reset role;

select * from finish();
rollback;
