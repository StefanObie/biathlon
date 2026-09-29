-- League teams and Roles decide who can use a League (#32).
--
-- Organization A runs League 1 and League 2. Its Admin is on no team. On
-- League 1's team are an Official, a Timekeeper, a Placer, someone who holds
-- both Timekeeper and Placer, and a Placer who was removed. A second
-- Timekeeper is on League 2's team only, and one more Member of A is on no
-- team at all. Each block below acts as one of them.

begin;
create extension if not exists pgtap with schema extensions;

select plan(80);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'org-admin@team.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'official@team.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'timekeeper@team.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'placer@team.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'both@team.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'removed@team.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'timekeeper2@team.test'),
  ('00000000-0000-0000-0000-000000000099', 'bystander@team.test'),
  ('00000000-0000-0000-0000-000000000088', 'outsider@team.test');

insert into organization (id, name) overriding system value values
  (901, 'Organization A');

insert into organization_member (organization_id, user_id, is_admin) values
  (901, '00000000-0000-0000-0000-00000000000a', true),
  (901, '00000000-0000-0000-0000-0000000000f1', false),
  (901, '00000000-0000-0000-0000-0000000000e1', false),
  (901, '00000000-0000-0000-0000-0000000000d1', false),
  (901, '00000000-0000-0000-0000-0000000000b1', false),
  (901, '00000000-0000-0000-0000-0000000000c1', false),
  (901, '00000000-0000-0000-0000-0000000000e2', false),
  (901, '00000000-0000-0000-0000-000000000099', false);

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (901, 'League 1', '2026-01-01', 2026, 901),
  (902, 'League 2', '2026-02-01', 2026, 901);

insert into league_team_member (league_id, user_id, role) values
  (901, '00000000-0000-0000-0000-0000000000f1', 'official'),
  (901, '00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
  (901, '00000000-0000-0000-0000-0000000000d1', 'placer'),
  (901, '00000000-0000-0000-0000-0000000000b1', 'timekeeper'),
  (901, '00000000-0000-0000-0000-0000000000b1', 'placer'),
  (901, '00000000-0000-0000-0000-0000000000c1', 'placer'),
  (902, '00000000-0000-0000-0000-0000000000e2', 'timekeeper');

update league_team_member set ended_at = now()
where user_id = '00000000-0000-0000-0000-0000000000c1';

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (901, 7, 'Test Athlete', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (901, 7, 1, 1, 1, 'U13'),
  (902, 7, 1, 1, 1, 'U13');

-- Heat 1 of each League is running; heat 2 of League 1 is closed.
insert into league_race (league_id, run_heat, started_at, device_id, closed_at, closed_by) values
  (901, 1, now(), 'dev', null, null),
  (901, 2, now(), 'dev', now(), 'official@team.test'),
  (902, 1, now(), 'dev', null, null);

insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values
  ('tc-1', 901, 1, 1, '05:00.00', 'dev', now()),
  ('tc-2', 902, 1, 1, '05:00.00', 'dev', now());

insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values
  ('pc-1', 901, 1, 1, 7, 'dev', now());

insert into run_result (league_id, athlete_no, run_heat, run_time, source) values
  (901, 7, 1, '05:00.00', 'auto');

insert into swim_result (league_id, athlete_no, event_no, heat, lane, swim_time, source) values
  (901, 7, 1, 1, 1, '01:00.00', 'import');

insert into audit_log (league_id, actor, entity, action) values
  (901, 'someone', 'league_race', 'close');

-- A League team entry names a Member of the League's Organization.
select throws_ok(
  $$ insert into league_team_member (league_id, user_id, role) values (901, '00000000-0000-0000-0000-000000000088', 'placer') $$,
  '23503', null, 'someone outside the organization can''t be put on a league team'
);

---------------------------------------------------------------------------
-- A Timekeeper on League 1 sees the heat list and uses the Timer screen.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "email": "timekeeper@team.test"}';

select results_eq($$ select id from league $$, $$ values (901) $$, 'a Timekeeper sees only the league they''re on');
select isnt_empty($$ select 1 from entry where league_id = 901 $$, 'a Timekeeper reads the heat list');
select isnt_empty($$ select 1 from athlete $$, 'a Timekeeper reads the organization''s athletes');
select isnt_empty($$ select 1 from time_capture where league_id = 901 $$, 'a Timekeeper reads time captures');
select isnt_empty($$ select 1 from league_race where league_id = 901 $$, 'a Timekeeper reads heat starts');
select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-tk', 901, 1, 2, '05:01.00', 'dev', now()) $$,
  'a Timekeeper adds a time capture'
);
select lives_ok(
  $$ update time_capture set voided = true, void_reason = 'undo' where id = 'tc-tk' $$,
  'a Timekeeper voids their time capture'
);
select lives_ok(
  $$ insert into league_race (league_id, run_heat, started_at, device_id) values (901, 3, now(), 'dev') $$,
  'a Timekeeper starts a heat'
);
select lives_ok(
  $$ delete from league_race where league_id = 901 and run_heat = 3 $$,
  'a Timekeeper resets a heat''s start'
);
select lives_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values ('on-tk', 901, 1, 0, 'timer', 'note', 'dev', now()) $$,
  'a Timekeeper adds a note on the Timer screen'
);
select throws_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values ('on-tk2', 901, 1, 0, 'position', 'note', 'dev', now()) $$,
  '42501', null, 'a Timekeeper can''t add a note on the Position screen'
);
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-tk', 901, 1, 2, null, 'dev', now()) $$,
  '42501', null, 'a Timekeeper can''t add a position capture'
);
select throws_ok(
  $$ update league_race set closed_at = now(), closed_by = 'tk' where league_id = 901 and run_heat = 1 $$,
  '42501', null, 'a Timekeeper can''t close a heat'
);
select throws_ok(
  $$ insert into league_race (league_id, run_heat, closed_at, closed_by) values (901, 4, now(), 'tk') $$,
  '42501', null, 'a Timekeeper can''t close a heat that was never started'
);
select is_empty(
  $$ update league_race set closed_at = null, closed_by = null where league_id = 901 and run_heat = 2 returning 1 $$,
  'a Timekeeper can''t reopen a heat'
);
select is_empty(
  $$ delete from league_race where league_id = 901 and run_heat = 2 returning 1 $$,
  'a Timekeeper can''t delete a closed heat'
);
select throws_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (901, 7, 2, '05:00.00', 'manual') $$,
  '42501', null, 'a Timekeeper can''t write run results'
);
select throws_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values (901, 8, 1, 1, 2, 'U13') $$,
  '42501', null, 'a Timekeeper can''t import entries'
);
select throws_ok(
  $$ insert into athlete (organization_id, athlete_no, full_name, gender) values (901, 8, 'New', 'M') $$,
  '42501', null, 'a Timekeeper can''t add athletes'
);
select is_empty($$ select 1 from run_result $$, 'a Timekeeper can''t read run results');
select is_empty($$ select 1 from swim_result $$, 'a Timekeeper can''t read swim results');
select is_empty($$ select 1 from audit_log $$, 'a Timekeeper can''t read the audit log');
select throws_ok(
  $$ insert into audit_log (league_id, actor, entity, action) values (901, 'tk', 'league_race', 'close') $$,
  '42501', null, 'a Timekeeper can''t write the audit log'
);
select throws_ok(
  $$ insert into league_team_member (league_id, user_id, role) values (901, '00000000-0000-0000-0000-000000000099', 'placer') $$,
  '42501', null, 'a Timekeeper can''t add someone to the team'
);

---------------------------------------------------------------------------
-- A Placer on League 1 uses the Position screen, and nothing else.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated", "email": "placer@team.test"}';

select isnt_empty($$ select 1 from entry where league_id = 901 $$, 'a Placer reads the heat list');
select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-pl', 901, 1, 2, 7, 'dev', now()) $$,
  'a Placer adds a position capture'
);
select lives_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values ('on-pl', 901, 1, 0, 'position', 'note', 'dev', now()) $$,
  'a Placer adds a note on the Position screen'
);
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-pl', 901, 1, 3, '05:02.00', 'dev', now()) $$,
  '42501', null, 'a Placer can''t add a time capture'
);
select throws_ok(
  $$ insert into league_race (league_id, run_heat, started_at, device_id) values (901, 5, now(), 'dev') $$,
  '42501', null, 'a Placer can''t start a heat'
);
select throws_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (901, 7, 2, '05:00.00', 'manual') $$,
  '42501', null, 'a Placer can''t write run results'
);
select is_empty($$ select 1 from audit_log $$, 'a Placer can''t read the audit log');

---------------------------------------------------------------------------
-- A Member holding both Timekeeper and Placer uses both capture screens.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated", "email": "both@team.test"}';

select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-both', 901, 1, 4, '05:03.00', 'dev', now()) $$,
  'a Timekeeper and Placer adds a time capture'
);
select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-both', 901, 1, 3, null, 'dev', now()) $$,
  'a Timekeeper and Placer adds a position capture'
);
select is_empty($$ select 1 from run_result $$, 'holding both capture Roles still doesn''t reach run results');

---------------------------------------------------------------------------
-- A Timekeeper on League 2 only can't read or write League 1.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "email": "timekeeper2@team.test"}';

select results_eq($$ select id from league $$, $$ values (902) $$, 'a Timekeeper on League 2 sees League 2 only');
select is_empty($$ select 1 from entry where league_id = 901 $$, 'League 2''s Timekeeper can''t read League 1''s entries');
select is_empty($$ select 1 from time_capture where league_id = 901 $$, 'League 2''s Timekeeper can''t read League 1''s time captures');
select is_empty($$ select 1 from position_capture where league_id = 901 $$, 'League 2''s Timekeeper can''t read League 1''s position captures');
select is_empty($$ select 1 from league_race where league_id = 901 $$, 'League 2''s Timekeeper can''t read League 1''s heats');
select is_empty($$ select 1 from operator_note where league_id = 901 $$, 'League 2''s Timekeeper can''t read League 1''s notes');
select is_empty($$ select 1 from league_team_member where league_id = 901 $$, 'League 2''s Timekeeper can''t read League 1''s team');
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-x', 901, 1, 9, '05:09.00', 'dev', now()) $$,
  '42501', null, 'League 2''s Timekeeper can''t add a time capture to League 1'
);
select is_empty(
  $$ update time_capture set voided = true where id = 'tc-1' returning 1 $$,
  'League 2''s Timekeeper can''t void League 1''s time captures'
);
select isnt_empty($$ select 1 from time_capture where league_id = 902 $$, 'League 2''s Timekeeper reads League 2''s time captures');

---------------------------------------------------------------------------
-- A removed Placer, and a Member on no team, can't use League 1.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated", "email": "removed@team.test"}';

select is_empty($$ select 1 from league $$, 'a removed Placer no longer sees the league');
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-rm', 901, 1, 9, null, 'dev', now()) $$,
  '42501', null, 'a removed Placer can''t add a position capture'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "bystander@team.test"}';

select results_eq($$ select name from organization $$, $$ values ('Organization A') $$, 'a Member on no team still sees their organization');
select is_empty($$ select 1 from league $$, 'a Member on no team sees no leagues');
select is_empty($$ select 1 from entry $$, 'a Member on no team reads no entries');
select is_empty($$ select 1 from athlete $$, 'a Member on no team reads no athletes');

---------------------------------------------------------------------------
-- An Official on League 1 runs League 1, and only League 1.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@team.test"}';

select lives_ok(
  $$ insert into athlete (organization_id, athlete_no, full_name, gender) values (901, 8, 'Walk Up', 'F') $$,
  'an Official adds an athlete'
);
select lives_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values (901, 8, 1, 1, 2, 'U13') $$,
  'an Official imports an entry'
);
select lives_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (901, 8, 1, '05:05.00', 'manual') $$,
  'an Official writes a run result'
);
select lives_ok(
  $$ insert into swim_result (league_id, athlete_no, event_no, heat, lane, swim_time, source) values (901, 8, 1, 1, 2, '01:05.00', 'manual') $$,
  'an Official writes a swim result'
);
select results_eq(
  $$ update league_race set closed_at = now(), closed_by = 'official' where league_id = 901 and run_heat = 1 returning run_heat $$,
  $$ values (1) $$,
  'an Official closes a heat'
);
select results_eq(
  $$ update league_race set closed_at = null, closed_by = null where league_id = 901 and run_heat = 2 returning run_heat $$,
  $$ values (2) $$,
  'an Official reopens a heat'
);
select lives_ok(
  $$ insert into audit_log (league_id, actor, entity, action) values (901, 'official', 'league_race', 'reopen') $$,
  'an Official writes the audit log'
);
select isnt_empty($$ select 1 from audit_log $$, 'an Official reads the audit log');
select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-of', 901, 1, 5, '05:04.00', 'dev', now()) $$,
  'an Official uses the Timer screen'
);
select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-of', 901, 1, 4, null, 'dev', now()) $$,
  'an Official uses the Position screen'
);
select is_empty($$ select 1 from league where id = 902 $$, 'an Official on League 1 can''t see League 2');
select throws_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (902, 7, 1, '05:00.00', 'manual') $$,
  '42501', null, 'an Official on League 1 can''t write League 2''s results'
);
select throws_ok(
  $$ insert into league_team_member (league_id, user_id, role) values (901, '00000000-0000-0000-0000-000000000099', 'placer') $$,
  '42501', null, 'an Official can''t change the team'
);
select is_empty($$ select 1 from organization_members(901) $$, 'an Official can''t list the organization''s Members');

---------------------------------------------------------------------------
-- An Admin runs every League of the Organization without being on a team,
-- and manages each League's team.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@team.test"}';

select results_eq($$ select id from league order by id $$, $$ values (901), (902) $$, 'an Admin sees every league');
select lives_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (902, 7, 1, '05:00.00', 'manual') $$,
  'an Admin writes results on a league they''re not on the team of'
);
select results_eq(
  $$ update league_race set closed_at = now(), closed_by = 'admin' where league_id = 902 and run_heat = 1 returning run_heat $$,
  $$ values (1) $$,
  'an Admin closes a heat on any league'
);
select isnt_empty($$ select 1 from audit_log where league_id = 901 $$, 'an Admin reads the audit log');
select results_eq(
  $$ insert into league (name, league_date, season, organization_id) values ('League 3', '2026-03-01', 2026, 901) returning name $$,
  $$ values ('League 3') $$,
  'an Admin creates a league and reads it back in the same statement'
);
select results_eq(
  $$ select count(*)::int from organization_members(901) where email is not null $$,
  $$ values (8) $$,
  'an Admin lists the organization''s Members with their emails'
);

select lives_ok(
  $$ insert into league_team_member (league_id, user_id, role) values (902, '00000000-0000-0000-0000-000000000099', 'placer') $$,
  'an Admin adds a Member to a league''s team'
);
select results_eq(
  $$ insert into league_team_member (league_id, user_id, role, started_at, ended_at) values (902, '00000000-0000-0000-0000-000000000099', 'timekeeper', '2000-01-01', '2000-01-02') returning started_at = now(), ended_at is null $$,
  $$ values (true, true) $$,
  'an Admin gives a Member a second Role, which starts now whatever time was sent'
);
select results_eq(
  $$ update league_team_member set ended_at = now() where league_id = 902 and user_id = '00000000-0000-0000-0000-000000000099' and role = 'placer' and ended_at is null returning role::text $$,
  $$ values ('placer') $$,
  'an Admin removes a Role by ending it'
);
select throws_ok(
  $$ delete from league_team_member where league_id = 902 $$,
  '42501', null, 'team entries are ended, never deleted'
);
select results_eq(
  $$ select action, coalesce(after, before) ->> 'role', coalesce(after, before) ->> 'email' from audit_log where entity = 'league_team' and actor = 'org-admin@team.test' order by at, action $$,
  $$ values ('add-role', 'placer', 'bystander@team.test'), ('add-role', 'timekeeper', 'bystander@team.test'), ('remove-role', 'placer', 'bystander@team.test') $$,
  'team changes are written to the audit log'
);

reset role;

select results_eq(
  $$ select count(*)::int from league_team_member where league_id = 902 and user_id = '00000000-0000-0000-0000-000000000099' $$,
  $$ values (2) $$,
  'the ended entry is still there'
);

-- The Member added above can now use League 2 as a Timekeeper, but not as
-- a Placer.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "bystander@team.test"}';

select results_eq($$ select id from league $$, $$ values (902) $$, 'a Member added to a team sees that league');
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-by', 902, 1, 1, null, 'dev', now()) $$,
  '42501', null, 'a Member whose Placer Role was ended can''t add a position capture'
);

---------------------------------------------------------------------------
-- Anonymous users can't read teams.
---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty($$ select 1 from league_team_member $$, 'anon: no league teams');

reset role;

select * from finish();
rollback;
