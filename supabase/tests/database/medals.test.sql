-- The Medals screen (#76): league_medals and medal_presentation.
--
-- Organization 961 runs Private League 961 with heat 1 (Closed) and heat 2
-- (open). Its team has an Official and a Placer. Organization 962 has one
-- Admin.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'official@medals.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'placer@medals.test'),
  ('00000000-0000-0000-0000-00000000000b', 'other-admin@medals.test');

insert into organization (id, name) overriding system value values
  (961, 'Medals Org'),
  (962, 'Other Org');

insert into organization_member (organization_id, user_id, is_admin) values
  (961, '00000000-0000-0000-0000-0000000000f1', false),
  (961, '00000000-0000-0000-0000-0000000000d1', false),
  (962, '00000000-0000-0000-0000-00000000000b', true);

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (961, 'Medals League', '2027-01-10', 2027, 961, 'private', null);

insert into league_team_member (league_id, user_id, role) values
  (961, '00000000-0000-0000-0000-0000000000f1', 'official'),
  (961, '00000000-0000-0000-0000-0000000000d1', 'placer');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (961, 1, 'Both Times', 'M'),
  (961, 2, 'Open Heat', 'M'),
  (961, 3, 'No Show', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (961, 1, 1, 1, 1, 'U13'),
  (961, 2, 2, 1, 2, 'U13'),
  (961, 3, 1, 1, 3, 'U13');

insert into league_race (league_id, run_heat, started_at, device_id, closed_at, closed_by) values
  (961, 1, now(), 'dev', now(), 'official'),
  (961, 2, now(), 'dev', null, null);

insert into run_result (league_id, athlete_no, run_heat, run_time, source) values
  (961, 1, 1, '03:00.00', 'reconcile'),
  (961, 2, 2, '03:10.00', 'reconcile');
insert into swim_result (league_id, athlete_no, event_no, heat, lane, swim_time, status, source) values
  (961, 1, 1, 1, 1, '00:40.00', 'ok', 'import'),
  (961, 2, 1, 1, 2, '00:41.00', 'ok', 'import');

---------------------------------------------------------------------------
-- league_medals: the published times, with athlete numbers, for Officials.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@medals.test"}';

select is(
  (select jsonb_agg(a order by a ->> 'athlete_no')
   from jsonb_array_elements(public.league_medals(961) -> 'athletes') a),
  '[
    {"athlete_no": 1, "full_name": "Both Times", "gender": "M", "age_group_code": "U13", "run_time": "03:00.00", "swim_time": "00:40.00"},
    {"athlete_no": 2, "full_name": "Open Heat", "gender": "M", "age_group_code": "U13", "run_time": null, "swim_time": "00:41.00"},
    {"athlete_no": 3, "full_name": "No Show", "gender": "M", "age_group_code": "U13", "run_time": null, "swim_time": null}
  ]'::jsonb,
  'an Official sees every entered athlete with only their published times, even in a Private League'
);
select is(
  (public.league_medals(961) ->> 'pool_length_m')::int,
  25,
  'league_medals returns the Pool length'
);
select ok(
  jsonb_array_length(public.league_medals(961) -> 'points_table') > 0,
  'league_medals returns the points table that applies on the League''s date'
);

select lives_ok(
  $$ insert into medal_presentation (league_id, gender, age_group_code, podium)
     values (961, 'M', 'U13', '[{"athlete_no": 1, "medal_place": 1}]') $$,
  'an Official marks a group''s medals presented'
);
select is(
  (select presented_by from medal_presentation where league_id = 961),
  '00000000-0000-0000-0000-0000000000f1'::uuid,
  'the mark records who presented'
);
select lives_ok(
  $$ update medal_presentation
     set podium = '[{"athlete_no": 2, "medal_place": 1}]', presented_at = now()
     where league_id = 961 and gender = 'M' and age_group_code = 'U13' $$,
  'an Official marks a group again'
);
select throws_ok(
  $$ insert into medal_presentation (league_id, gender, age_group_code, podium)
     values (961, 'M', 'U15', '{"athlete_no": 1}') $$,
  '23514', null,
  'a podium that is not a list is rejected'
);

---------------------------------------------------------------------------
-- Anyone else: no medal data, and no marks.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated", "email": "placer@medals.test"}';

select throws_ok(
  $$ select public.league_medals(961) $$,
  '42501', null,
  'a Placer cannot read the medal data'
);
select is_empty(
  $$ select 1 from medal_presentation $$,
  'a Placer cannot see Medals presented marks'
);
select throws_ok(
  $$ insert into medal_presentation (league_id, gender, age_group_code, podium)
     values (961, 'F', 'U13', '[]') $$,
  '42501', null,
  'a Placer cannot mark medals presented'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated", "email": "other-admin@medals.test"}';

select throws_ok(
  $$ select public.league_medals(961) $$,
  '42501', null,
  'an Admin of another Organization cannot read the medal data'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select public.league_medals(961) $$,
  '42501', null,
  'anon cannot call league_medals'
);

---------------------------------------------------------------------------
-- Clearing the mark.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@medals.test"}';

select lives_ok(
  $$ delete from medal_presentation where league_id = 961 $$,
  'an Official clears the mark'
);
select is_empty(
  $$ select 1 from medal_presentation where league_id = 961 $$,
  'the cleared mark is gone'
);

select * from finish();
rollback;
