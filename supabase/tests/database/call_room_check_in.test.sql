-- Call room check-ins (#41). Who may check an athlete in and undo it, one
-- check-in per athlete per League, Closed heats read-only.
--
-- Organization A runs League 1, with athletes 7 and 8 in heat 1, athlete 9
-- in heat 2 and heat 3 Closed. On its team are a Caller, an Official, a
-- Timekeeper and a Placer; its Admin is on no team, and one more Member is
-- on no team at all. Organization B's Member is an outsider.

begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'org-admin@checkin.test'),
  ('00000000-0000-0000-0000-0000000000ca', 'caller@checkin.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'official@checkin.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'timekeeper@checkin.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'placer@checkin.test'),
  ('00000000-0000-0000-0000-000000000099', 'bystander@checkin.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'outsider@checkin.test');

insert into organization (id, name) overriding system value values
  (911, 'Organization A'),
  (912, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (911, '00000000-0000-0000-0000-00000000000a', true),
  (911, '00000000-0000-0000-0000-0000000000ca', false),
  (911, '00000000-0000-0000-0000-0000000000f1', false),
  (911, '00000000-0000-0000-0000-0000000000e1', false),
  (911, '00000000-0000-0000-0000-0000000000d1', false),
  (911, '00000000-0000-0000-0000-000000000099', false),
  (912, '00000000-0000-0000-0000-0000000000b1', false);

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (911, 'League 1', '2026-01-01', 2026, 911);

insert into league_team_member (league_id, user_id, role) values
  (911, '00000000-0000-0000-0000-0000000000ca', 'caller'),
  (911, '00000000-0000-0000-0000-0000000000f1', 'official'),
  (911, '00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
  (911, '00000000-0000-0000-0000-0000000000d1', 'placer');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (911, 7, 'Athlete Seven', 'M'),
  (911, 8, 'Athlete Eight', 'F'),
  (911, 9, 'Athlete Nine', 'F'),
  (911, 10, 'Athlete Ten', 'M'),
  (911, 11, 'Athlete Eleven', 'M'),
  (911, 12, 'Not Entered', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (911, 7, 1, 1, 1, 'U13'),
  (911, 8, 1, 1, 2, 'U13'),
  (911, 9, 2, 1, 3, 'U13'),
  (911, 10, 3, 1, 4, 'U13'),
  (911, 11, 3, 1, 5, 'U13');

insert into league_race (league_id, run_heat, started_at, closed_at, closed_by, device_id) values
  (911, 3, now(), now(), 'official@checkin.test', 'dev');

-- Athlete 11 was checked in to the Closed heat before it closed.
insert into call_room_check_in (league_id, athlete_no, run_heat) values
  (911, 11, 3);

set local role authenticated;

---------------------------------------------------------------------------
-- A Caller checks in and undoes.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated", "email": "caller@checkin.test"}';

select lives_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 7, 1) $$,
  'a Caller can check in an athlete'
);
select results_eq(
  $$ select run_heat, checked_in_by from call_room_check_in where athlete_no = 7 $$,
  $$ values (1, '00000000-0000-0000-0000-0000000000ca'::uuid) $$,
  'the check-in records the heat and who made it'
);
select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 7, 1) $$,
  '23505', null, 'an athlete has at most one check-in per League'
);
select lives_ok(
  $$ update call_room_check_in set run_heat = 2 where athlete_no = 7 $$,
  'a Caller can move a check-in to another open heat'
);
select results_eq(
  $$ select run_heat from call_room_check_in where athlete_no = 7 $$,
  $$ values (2) $$,
  'the athlete is checked in at the new heat only'
);
select lives_ok(
  $$ delete from call_room_check_in where athlete_no = 7 $$,
  'a Caller can undo a check-in'
);
select is_empty(
  $$ select 1 from call_room_check_in where athlete_no = 7 $$,
  'undoing removes the check-in'
);
select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 12, 1) $$,
  '23503', null, 'an athlete not entered in the League can''t be checked in'
);

---------------------------------------------------------------------------
-- A Closed heat is read-only.
---------------------------------------------------------------------------

select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 10, 3) $$,
  '42501', null, 'no check-in on a Closed heat'
);
-- RLS hides a Closed heat's row from delete and update rather than raising.
delete from call_room_check_in where athlete_no = 11;
select isnt_empty(
  $$ select 1 from call_room_check_in where athlete_no = 11 and run_heat = 3 $$,
  'no undo on a Closed heat'
);
update call_room_check_in set run_heat = 1 where athlete_no = 11;
select isnt_empty(
  $$ select 1 from call_room_check_in where athlete_no = 11 and run_heat = 3 $$,
  'no moving an athlete away from a Closed heat'
);
select lives_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 8, 1) $$,
  'a Caller can check in to an open heat'
);
select throws_ok(
  $$ update call_room_check_in set run_heat = 3 where athlete_no = 8 $$,
  '42501', null, 'no moving an athlete onto a Closed heat'
);

-- Reopened by an Official, the heat takes changes again.
reset role;
update league_race set closed_at = null, closed_by = null where league_id = 911 and run_heat = 3;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated", "email": "caller@checkin.test"}';

select lives_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 10, 3) $$,
  'check-ins are allowed again after the heat is reopened'
);
select lives_ok(
  $$ delete from call_room_check_in where athlete_no = 11 $$,
  'undo is allowed again after the heat is reopened'
);

---------------------------------------------------------------------------
-- An Official and an Admin can too.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@checkin.test"}';
select lives_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 9, 2) $$,
  'an Official can check in an athlete'
);
select lives_ok(
  $$ delete from call_room_check_in where athlete_no = 9 $$,
  'an Official can undo a check-in'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "org-admin@checkin.test"}';
select lives_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 9, 2) $$,
  'an Admin can check in an athlete without being on the team'
);
select lives_ok(
  $$ delete from call_room_check_in where athlete_no = 9 $$,
  'an Admin can undo a check-in'
);

---------------------------------------------------------------------------
-- Everyone else can't write.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "email": "timekeeper@checkin.test"}';
select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 9, 2) $$,
  '42501', null, 'a Timekeeper can''t check in'
);
delete from call_room_check_in where athlete_no = 8;
select isnt_empty(
  $$ select 1 from call_room_check_in where athlete_no = 8 $$,
  'a Timekeeper can''t undo'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated", "email": "placer@checkin.test"}';
select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 9, 2) $$,
  '42501', null, 'a Placer can''t check in'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "bystander@checkin.test"}';
select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 9, 2) $$,
  '42501', null, 'a Member off the League team can''t check in'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated", "email": "outsider@checkin.test"}';
select throws_ok(
  $$ insert into call_room_check_in (league_id, athlete_no, run_heat) values (911, 9, 2) $$,
  '42501', null, 'an outsider can''t check in'
);
select is_empty($$ select 1 from call_room_check_in $$, 'an outsider can''t read check-ins');

select * from finish();
rollback;
