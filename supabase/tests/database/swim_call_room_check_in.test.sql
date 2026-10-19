-- Swim call room check-ins. Who may check an athlete in to a swim heat and
-- undo it, one swim check-in per athlete per League, kept apart from the run
-- check-in, and never locked: a Closed run heat doesn't stop them.
--
-- Organization A runs League 1, with athletes 7 and 8 in swim heat 1,
-- athlete 9 in swim heat 2 and athlete 10, a Late entry, with no swim slot.
-- Run heat 1 is Closed. On its team are a Caller, an Official, a Timekeeper
-- and a Placer; one more Member is on no team at all. Organization B's
-- Member is an outsider.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'org-admin@swimcheckin.test'),
  ('00000000-0000-0000-0000-0000000000ca', 'caller@swimcheckin.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'official@swimcheckin.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'timekeeper@swimcheckin.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'placer@swimcheckin.test'),
  ('00000000-0000-0000-0000-000000000099', 'bystander@swimcheckin.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'outsider@swimcheckin.test');

insert into organization (id, name) overriding system value values
  (921, 'Organization A'),
  (922, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (921, '00000000-0000-0000-0000-00000000000a', true),
  (921, '00000000-0000-0000-0000-0000000000ca', false),
  (921, '00000000-0000-0000-0000-0000000000f1', false),
  (921, '00000000-0000-0000-0000-0000000000e1', false),
  (921, '00000000-0000-0000-0000-0000000000d1', false),
  (921, '00000000-0000-0000-0000-000000000099', false),
  (922, '00000000-0000-0000-0000-0000000000b1', false);

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (921, 'League 1', '2026-01-01', 2026, 921);

insert into league_team_member (league_id, user_id, role) values
  (921, '00000000-0000-0000-0000-0000000000ca', 'caller'),
  (921, '00000000-0000-0000-0000-0000000000f1', 'official'),
  (921, '00000000-0000-0000-0000-0000000000e1', 'timekeeper'),
  (921, '00000000-0000-0000-0000-0000000000d1', 'placer');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (921, 7, 'Athlete Seven', 'M'),
  (921, 8, 'Athlete Eight', 'F'),
  (921, 9, 'Athlete Nine', 'F'),
  (921, 10, 'Athlete Ten', 'M'),
  (921, 12, 'Not Entered', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (921, 7, 1, 1, 1, 'U13'),
  (921, 8, 1, 1, 2, 'U13'),
  (921, 9, 2, 2, 1, 'U13'),
  (921, 10, 2, null, null, 'U13');

insert into league_race (league_id, run_heat, started_at, closed_at, closed_by, device_id) values
  (921, 1, now(), now(), 'official@swimcheckin.test', 'dev');

insert into call_room_check_in (league_id, athlete_no, run_heat) values
  (921, 9, 2);

set local role authenticated;

---------------------------------------------------------------------------
-- A Caller checks in, moves and undoes.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated", "email": "caller@swimcheckin.test"}';

select lives_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 7, 1) $$,
  'a Caller can check an athlete in to a swim heat, even when their run heat is Closed'
);
select results_eq(
  $$ select swim_heat, checked_in_by from swim_call_room_check_in where athlete_no = 7 $$,
  $$ values (1, '00000000-0000-0000-0000-0000000000ca'::uuid) $$,
  'the swim check-in records the swim heat and who made it'
);
select throws_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 7, 2) $$,
  '23505', null, 'an athlete has at most one swim check-in per League'
);
select lives_ok(
  $$ update swim_call_room_check_in set swim_heat = 2 where athlete_no = 7 $$,
  'a Caller can move a swim check-in to another swim heat'
);
select results_eq(
  $$ select swim_heat from swim_call_room_check_in where athlete_no = 7 $$,
  $$ values (2) $$,
  'the athlete is checked in at the new swim heat only'
);
select lives_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 9, 2) $$,
  'an athlete checked in for their run can also be checked in for their swim'
);
select results_eq(
  $$ select run_heat from call_room_check_in where athlete_no = 9 $$,
  $$ values (2) $$,
  'the run check-in is untouched by the swim one'
);
select lives_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 10, 1) $$,
  'an athlete with no swim slot can be checked in to a swim heat'
);
select is(
  (select swim_heat from entry where league_id = 921 and athlete_no = 10),
  null,
  'a swim check-in never sets the swim slot'
);
select lives_ok(
  $$ delete from swim_call_room_check_in where athlete_no = 7 $$,
  'a Caller can undo a swim check-in'
);
select is_empty(
  $$ select 1 from swim_call_room_check_in where athlete_no = 7 $$,
  'undoing removes the swim check-in'
);
select throws_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 12, 1) $$,
  '23503', null, 'an athlete not entered in the League can''t be checked in'
);

---------------------------------------------------------------------------
-- An Official covers the Caller.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@swimcheckin.test"}';

select lives_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 8, 1) $$,
  'an Official can check an athlete in to a swim heat'
);

---------------------------------------------------------------------------
-- A Timekeeper reads but can't write; others see nothing.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "email": "timekeeper@swimcheckin.test"}';

select results_eq(
  $$ select count(*)::int from swim_call_room_check_in where league_id = 921 $$,
  $$ values (3) $$,
  'a Timekeeper can read the League''s swim check-ins'
);
select throws_ok(
  $$ insert into swim_call_room_check_in (league_id, athlete_no, swim_heat) values (921, 7, 1) $$,
  '42501', null, 'a Timekeeper can''t check an athlete in'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated", "email": "outsider@swimcheckin.test"}';

select is_empty(
  $$ select 1 from swim_call_room_check_in where league_id = 921 $$,
  'an outsider sees no swim check-ins'
);

select * from finish();
rollback;
