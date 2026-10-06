-- A Caller adds an athlete of the Organization to the Start list on
-- check-in (#68): public.check_in_late_entry adds a Late entry in the heat
-- being called, with no swim slot and the age group of the athlete's latest
-- entry, and checks them in. It opens nothing else to Callers: they still
-- can't write entries or athletes themselves.
--
-- Organization 971 runs League 971, with athletes 7 and 8 in heat 1 and
-- heat 2 Closed with athlete 9 in it. Athlete 6918 raced in League 972 in
-- U15 and athlete 6919 was never entered. On League 971's team are a Caller
-- and a Placer; another Caller is only on League 972's team.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001ca', 'caller@late-check-in.test'),
  ('00000000-0000-0000-0000-0000000001d1', 'placer@late-check-in.test'),
  ('00000000-0000-0000-0000-0000000001cb', 'other-caller@late-check-in.test');

insert into organization (id, name) overriding system value values
  (971, 'Late Check-in Org'),
  (972, 'Other Org');

insert into organization_member (organization_id, user_id) values
  (971, '00000000-0000-0000-0000-0000000001ca'),
  (971, '00000000-0000-0000-0000-0000000001d1'),
  (971, '00000000-0000-0000-0000-0000000001cb');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (971, 'League 1', '2027-02-07', 2027, 971),
  (972, 'League 0', '2027-01-31', 2027, 971);

insert into league_team_member (league_id, user_id, role) values
  (971, '00000000-0000-0000-0000-0000000001ca', 'caller'),
  (971, '00000000-0000-0000-0000-0000000001d1', 'placer'),
  (972, '00000000-0000-0000-0000-0000000001cb', 'caller');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (971, 7, 'Athlete Seven', 'M'),
  (971, 8, 'Athlete Eight', 'F'),
  (971, 9, 'Athlete Nine', 'F'),
  (971, 6918, 'Raced Before', 'M'),
  (971, 6919, 'Never Entered', 'F'),
  (972, 5000, 'Other Org Athlete', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (971, 7, 1, 1, 1, 'U13'),
  (971, 8, 1, 1, 2, 'U13'),
  (971, 9, 2, 1, 3, 'U13'),
  (972, 6918, 4, 2, 5, 'U15');

insert into league_race (league_id, run_heat, started_at, closed_at, closed_by, device_id) values
  (971, 2, now(), now(), 'official@late-check-in.test', 'dev');

set local role authenticated;

---------------------------------------------------------------------------
-- The Caller adds a Late entry on check-in.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000001ca", "role": "authenticated"}';

select lives_ok(
  $$ select public.check_in_late_entry(971, 6918, 1) $$,
  'a Caller can add an athlete of the Organization not on the Start list'
);
select results_eq(
  $$ select run_heat, swim_heat, swim_lane, age_group_code
     from entry where league_id = 971 and athlete_no = 6918 $$,
  $$ values (1, null::integer, null::integer, 'U15') $$,
  'the Late entry is in the heat being called, with no swim slot and the latest age group'
);
select results_eq(
  $$ select run_heat, checked_in_by from call_room_check_in
     where league_id = 971 and athlete_no = 6918 $$,
  $$ values (1, '00000000-0000-0000-0000-0000000001ca'::uuid) $$,
  'the athlete is checked in at the heat by the Caller'
);

---------------------------------------------------------------------------
-- What the function refuses.
---------------------------------------------------------------------------

select throws_ok(
  $$ select public.check_in_late_entry(971, 7, 1) $$,
  '23505', null,
  'an athlete already on the Start list is refused'
);
select throws_ok(
  $$ select public.check_in_late_entry(971, 9, 1) $$,
  '23505', null,
  'an athlete on the Start list in another heat is refused'
);
select results_eq(
  $$ select run_heat from entry where league_id = 971 and athlete_no = 9 $$,
  $$ values (2) $$,
  'and is not moved between heats'
);
select throws_ok(
  $$ select public.check_in_late_entry(971, 5000, 1) $$,
  '22023', null,
  'a number that belongs to no athlete of the Organization is refused'
);
select throws_ok(
  $$ select public.check_in_late_entry(971, 6919, 1) $$,
  '22023', null,
  'an athlete with no earlier entry has no age group to take, so is refused'
);
select throws_ok(
  $$ select public.check_in_late_entry(971, 6919, 5) $$,
  '22023', null,
  'a heat with no one on the Start list is refused'
);
select throws_ok(
  $$ select public.check_in_late_entry(971, 6919, 2) $$,
  '42501', null,
  'a Closed heat is refused'
);

---------------------------------------------------------------------------
-- Callers still can't write entries or athletes themselves.
---------------------------------------------------------------------------

select throws_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, age_group_code)
     values (971, 6919, 1, 'U13') $$,
  '42501', null,
  'a Caller still can''t insert an entry'
);
update entry set run_heat = 1 where league_id = 971 and athlete_no = 9;
select results_eq(
  $$ select run_heat from entry where league_id = 971 and athlete_no = 9 $$,
  $$ values (2) $$,
  'a Caller still can''t move anyone between heats'
);
update entry set age_group_code = 'U15', swim_heat = null, swim_lane = null
  where league_id = 971 and athlete_no = 7;
select results_eq(
  $$ select age_group_code, swim_heat, swim_lane from entry
     where league_id = 971 and athlete_no = 7 $$,
  $$ values ('U13', 1, 1) $$,
  'a Caller still can''t change an existing entry'
);
select throws_ok(
  $$ insert into athlete (organization_id, athlete_no, full_name, gender)
     values (971, 7777, 'Brand New', 'M') $$,
  '42501', null,
  'a Caller still can''t create an athlete'
);

---------------------------------------------------------------------------
-- Only a Caller of this League.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000001d1", "role": "authenticated"}';

select throws_ok(
  $$ select public.check_in_late_entry(971, 6919, 1) $$,
  '42501', null,
  'a Placer can''t add a Late entry'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000001cb", "role": "authenticated"}';

select throws_ok(
  $$ select public.check_in_late_entry(971, 6919, 1) $$,
  '42501', null,
  'a Caller of another League can''t add a Late entry here'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select public.check_in_late_entry(971, 6919, 1) $$,
  '42501', null,
  'anonymous users can''t call it'
);

select * from finish();
rollback;
