-- League Visibility, the Results slug and anonymous results (#28).
--
-- Organization A (Admin, Official) runs Leagues 951-956 with heats 1 (Closed)
-- and 2 (open, or reopened). Organization B has one Admin.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@results.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'official@results.test'),
  ('00000000-0000-0000-0000-00000000000b', 'other-admin@results.test');

insert into organization (id, name) overriding system value values
  (951, 'Crossland GNB'),
  (952, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (951, '00000000-0000-0000-0000-00000000000a', true),
  (951, '00000000-0000-0000-0000-0000000000f1', false),
  (952, '00000000-0000-0000-0000-00000000000b', true);

-- A League inserted without a slug gets the default Public one.
insert into league (id, name, league_date, season, organization_id) overriding system value values
  (951, 'League 1', '2027-01-10', 2027, 951);
insert into league (id, name, league_date, season, organization_id) overriding system value values
  (952, 'League 1', '2027-01-17', 2027, 951);

select is(
  (select results_slug from league where id = 951),
  'crossland-gnb-league-1',
  'a new League defaults to Public with the Organization and League names as its slug'
);
select is(
  (select results_slug from league where id = 952),
  'crossland-gnb-league-1-2',
  'a colliding default slug gets a counter'
);

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (953, 'Protected One', '2027-02-01', 2027, 951, 'protected', 'Abcdefghijklmnopqrstuv_-XYZ'),
  (954, 'Private One', '2027-02-08', 2027, 951, 'private', null),
  (955, 'Org B League', '2027-02-15', 2027, 952, 'public', 'org-b-league');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (951, 1, 'Closed Athlete', 'M'),
  (951, 2, 'Open Athlete', 'F');

insert into points_table (
  effective_from, gender, age_group_code, age_group_label, sort_order, age_from, age_to,
  run_distance_m, run_base_time, run_points_per_second,
  swim_distance_m, swim_base_time, swim_points_per_second, bonus_points_per_year
) values ('1900-01-01', 'M', 'TST', 'Test', 1, 0, 99, 1000, '05:00.00', 1, 100, '01:00.00', 1, 0)
on conflict do nothing;

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (951, 1, 1, 1, 1, 'U13'),
  (951, 2, 2, 1, 2, 'U13'),
  (953, 1, 1, 1, 1, 'U13');

insert into league_race (league_id, run_heat, started_at, device_id, closed_at, closed_by) values
  (951, 1, now(), 'dev', now(), 'official'),
  (951, 2, now(), 'dev', null, null),
  (953, 1, now(), 'dev', now(), 'official'),
  (954, 1, now(), 'dev', now(), 'official');

insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values
  ('tc-open', 951, 2, 1, '05:00.00', 'dev', now());
insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values
  ('on-open', 951, 1, 0, 'timer', 'secret note', 'dev', now());
insert into audit_log (league_id, actor, entity, action) values
  (951, 'someone', 'league_race', 'close');

---------------------------------------------------------------------------
-- The database refuses a bad slug, whichever path writes it.
---------------------------------------------------------------------------

select throws_ok(
  $$ update league set results_slug = 'crossland-gnb-league-1' where id = 955 $$,
  '23505', null,
  'a duplicate slug is rejected by the unique constraint'
);
select throws_ok(
  $$ update league set results_slug = 'Not Valid' where id = 955 $$,
  '23514', null,
  'a malformed custom slug is rejected'
);
select throws_ok(
  $$ update league set results_slug = 'ab' where id = 955 $$,
  '23514', null,
  'a custom slug under 3 characters is rejected'
);
select throws_ok(
  $$ update league set results_slug = '-leading' where id = 955 $$,
  '23514', null,
  'a custom slug with a leading hyphen is rejected'
);
select throws_ok(
  $$ update league set results_slug = 'double--hyphen' where id = 955 $$,
  '23514', null,
  'a custom slug with a double hyphen is rejected'
);
select throws_ok(
  $$ update league set results_slug = repeat('a', 81) where id = 955 $$,
  '23514', null,
  'a custom slug over 80 characters is rejected'
);
select throws_ok(
  $$ update league set results_slug = 'somewhere' where id = 954 $$,
  '23514', null,
  'a Private League with a slug is rejected'
);
select throws_ok(
  $$ update league set results_slug = null where id = 955 $$,
  '23514', null,
  'a Public League without a slug is rejected'
);
select throws_ok(
  $$ update league set visibility = 'protected', results_slug = 'lowercaseonlylowercaseonly' where id = 955 $$,
  '23514', null,
  'a random slug without an uppercase letter is rejected, so it can never be a custom slug'
);
select throws_ok(
  $$ update league set visibility = 'protected', results_slug = 'Short1' where id = 955 $$,
  '23514', null,
  'a random slug under 22 characters is rejected'
);

---------------------------------------------------------------------------
-- Anonymous readers.
---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$ select l ->> 'name', l -> 'heats' -> 0 ->> 'run_heat', jsonb_array_length(l -> 'heats')::text
     from (select public.league_results('crossland-gnb-league-1') as l) s $$,
  $$ values ('League 1', '1', '1') $$,
  'Public: readable by slug, Closed heats only'
);
select is(
  (select public.league_results('crossland-gnb-league-1') -> 'heats' -> 0 -> 'athletes' -> 0 ->> 'full_name'),
  'Closed Athlete',
  'Public: lists the athletes of a Closed heat'
);
select is(
  (select public.league_results('crossland-gnb-league-1')::text like '%Open Athlete%'),
  false,
  'Public: an athlete of a heat that is not Closed is not shown'
);
select is(
  (select public.league_results('Abcdefghijklmnopqrstuv_-XYZ') ->> 'visibility'),
  'protected',
  'Protected: readable by its random slug'
);
select is(
  (select public.league_results('Abcdefghijklmnopqrstuv_-xyz')),
  null,
  'Protected: a different slug returns nothing'
);
select is(
  (select public.league_results('private-one')),
  null,
  'Private: nothing is readable'
);
select is(
  (select public.league_results('no-such-league')),
  null,
  'an unknown slug returns nothing, just like a Private League'
);
select is((select public.league_results(null)), null, 'a null slug returns nothing');

select is_empty($$ select 1 from league $$, 'anon: still no leagues');
select is_empty($$ select 1 from entry $$, 'anon: still no entries');
select is_empty($$ select 1 from league_race $$, 'anon: still no heats');
select is_empty($$ select 1 from operator_note $$, 'anon: no operator notes');
select is_empty($$ select 1 from time_capture $$, 'anon: no captures');
select is_empty($$ select 1 from audit_log $$, 'anon: no audit log');

---------------------------------------------------------------------------
-- Only an Admin changes Visibility or the slug.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "email": "official@results.test"}';

select is_empty(
  $$ update league set visibility = 'private', results_slug = null where id = 951 returning 1 $$,
  'an Official can''t change Visibility'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated", "email": "other-admin@results.test"}';

select is_empty(
  $$ update league set results_slug = 'hijacked' where id = 951 returning 1 $$,
  'an Admin of another Organization can''t change the slug'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "admin@results.test"}';

select lives_ok(
  $$ update league set results_slug = 'gnb-league-1' where id = 951 $$,
  'an Admin changes the slug'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select public.league_results('crossland-gnb-league-1')),
  null,
  'the old address stops working'
);

-- Protected: changing the slug (regenerating) and going Private, as an Admin.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "email": "admin@results.test"}';

select lives_ok(
  $$ update league set results_slug = 'Regeneratedslug0123456789' where id = 953 $$,
  'an Admin regenerates a Protected slug'
);
select lives_ok(
  $$ update league set visibility = 'private', results_slug = null where id = 952 $$,
  'an Admin makes a League Private'
);
select lives_ok(
  $$ update league set visibility = 'public', results_slug = 'back-again' where id = 954 $$,
  'an Admin makes a Private League Public with a slug'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select public.league_results('Abcdefghijklmnopqrstuv_-XYZ')),
  null,
  'Protected: a regenerated-away slug returns nothing'
);

select * from finish();
rollback;
