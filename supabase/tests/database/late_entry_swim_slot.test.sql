-- Late entries (#65): the swim slot is optional, but swim heat and swim lane
-- are both set or both empty; and an athlete's latest age group in the
-- Organization is readable by anyone on one of its League teams, even
-- without access to the League it came from.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into organization (id, name) overriding system value values
  (961, 'Late Entry Org');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (961, 'League 1', '2027-01-10', 2027, 961);

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (961, 1, 'No Swim Slot', 'M'),
  (961, 2, 'Only Swim Heat', 'F'),
  (961, 3, 'Only Swim Lane', 'F');

insert into points_table (
  effective_from, gender, age_group_code, age_group_label, sort_order, age_from, age_to,
  run_distance_m, run_base_time, run_points_per_second,
  swim_distance_m, swim_base_time, swim_points_per_second, bonus_points_per_year
) values ('1900-01-01', 'M', 'TST', 'Test', 1, 0, 99, 1000, '05:00.00', 1, 100, '01:00.00', 1, 0)
on conflict do nothing;

select lives_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code)
     values (961, 1, 1, null, null, 'U13') $$,
  'an entry with no swim slot is accepted'
);
select throws_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code)
     values (961, 2, 1, 3, null, 'U13') $$,
  '23514', null,
  'an entry with a swim heat but no swim lane is rejected'
);
select throws_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code)
     values (961, 3, 1, null, 4, 'U13') $$,
  '23514', null,
  'an entry with a swim lane but no swim heat is rejected'
);

-- The athlete with no swim slot runs in a Closed heat.
insert into league_race (league_id, run_heat, started_at, device_id, closed_at, closed_by) values
  (961, 1, now(), 'dev', now(), 'official');
insert into run_result (league_id, athlete_no, run_heat, run_time, source) values
  (961, 1, 1, '03:00.00', 'reconcile');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$ select a ->> 'full_name', a ->> 'run_time'
     from jsonb_array_elements(public.league_results('late-entry-org-league-1') -> 'athletes') a $$,
  $$ values ('No Swim Slot', '03:00.00') $$,
  'an entry with no swim slot appears in published results'
);
select is(
  (select public.league_results('late-entry-org-league-1') ->> 'heats_closed'),
  '1',
  'the heat of an entry with no swim slot counts as Closed'
);

---------------------------------------------------------------------------
-- The latest age group lookup.
---------------------------------------------------------------------------

reset role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'official@late.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'outsider@late.test');
insert into organization_member (organization_id, user_id) values
  (961, '00000000-0000-0000-0000-0000000000c1'),
  (961, '00000000-0000-0000-0000-0000000000c2');

-- Leagues 962 (earlier) and 963 (later) and 964 (same date as 963, newer).
-- The Official is only on the team of League 961.
insert into league (id, name, league_date, season, organization_id) overriding system value values
  (962, 'League 0', '2027-01-03', 2027, 961),
  (963, 'League 2', '2027-01-17', 2027, 961),
  (964, 'League 2b', '2027-01-17', 2027, 961);
insert into league_team_member (league_id, user_id, role) values
  (961, '00000000-0000-0000-0000-0000000000c1', 'official');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (961, 6918, 'Raced Before', 'F'),
  (961, 5478, 'Raced On A Tie', 'M');
insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (963, 6918, 1, 1, 1, 'U13'),
  (962, 6918, 1, 1, 1, 'U11'),
  (963, 5478, 1, 1, 2, 'U15'),
  (964, 5478, 1, 1, 2, 'U17');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select is_empty(
  $$ select 1 from entry where league_id = 963 $$,
  'the Official cannot read entries of a League they are not on'
);
select results_eq(
  $$ select athlete_no, age_group_code from public.latest_age_groups(961, array[6918, 5478, 1, 77])
     order by athlete_no $$,
  $$ values (1, 'U13'), (5478, 'U17'), (6918, 'U13') $$,
  'an Official reads each athlete''s age group from the latest League, the newest winning a tie, and nothing for an athlete never entered'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated"}';

select is_empty(
  $$ select * from public.latest_age_groups(961, array[6918]) $$,
  'a Member with no League role reads nothing'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select * from public.latest_age_groups(961, array[6918]) $$,
  '42501', null,
  'anonymous readers cannot call the lookup'
);

select * from finish();
rollback;
