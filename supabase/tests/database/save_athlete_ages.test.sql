-- Uploading the age file (#82): an Admin of the Organization saves birth years
-- by athlete number, with one audit row for the upload.
--
-- Organization 981 has an Admin and an Official, athletes 1 to 3, and League
-- 981 at a public slug. Organization 982 has its own Admin and its own athlete 1.

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000098101', 'admin@ages.test'),
  ('00000000-0000-0000-0000-000000098102', 'official@ages.test'),
  ('00000000-0000-0000-0000-000000098103', 'other-admin@ages.test');

insert into organization (id, name) overriding system value values
  (981, 'Ages Org'),
  (982, 'Other Org');

insert into organization_member (organization_id, user_id, is_admin) values
  (981, '00000000-0000-0000-0000-000000098101', true),
  (981, '00000000-0000-0000-0000-000000098102', false),
  (982, '00000000-0000-0000-0000-000000098103', true);

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (981, 'Ages League', '2027-01-10', 2027, 981, 'public', 'ages-league');

insert into league_team_member (league_id, user_id, role) values
  (981, '00000000-0000-0000-0000-000000098102', 'official');

insert into athlete (organization_id, athlete_no, full_name, gender, birth_year) values
  (981, 1, 'First Athlete', 'M', null),
  (981, 2, 'Second Athlete', 'F', 1980),
  (981, 3, 'Missing From File', 'M', 1975),
  (982, 1, 'Other Org Athlete', 'M', 1990);

-- Who may upload.

set local role authenticated;

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000098102", "email": "official@ages.test", "role": "authenticated"}';
select throws_ok(
  $$ select public.save_athlete_ages(981, 2026, '[{"athlete_no": 1, "birth_year": 1990}]') $$,
  '42501', 'Only an Admin of the Organization can upload ages',
  'an Official cannot upload'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000098103", "email": "other-admin@ages.test", "role": "authenticated"}';
select throws_ok(
  $$ select public.save_athlete_ages(981, 2026, '[{"athlete_no": 1, "birth_year": 1990}]') $$,
  '42501', 'Only an Admin of the Organization can upload ages',
  'an Admin of another Organization cannot upload'
);

reset role;
select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 1),
  null,
  'a refused upload writes nothing'
);
select is(
  (select count(*)::integer from audit_log where organization_id = 981),
  0,
  'a refused upload writes no audit row'
);

-- A good upload.

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000098101", "email": "admin@ages.test", "role": "authenticated"}';

select is(
  public.save_athlete_ages(
    981,
    2026,
    '[{"athlete_no": 1, "birth_year": 1990}, {"athlete_no": 2, "birth_year": 1985}, {"athlete_no": 99, "birth_year": 2000}]'
  ),
  2,
  'returns how many athletes were updated, leaving out unknown numbers'
);

reset role;

select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 1),
  1990,
  'an empty birth year is filled'
);
select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 2),
  1985,
  'an existing birth year is overwritten'
);
select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 3),
  1975,
  'an athlete missing from the file keeps their birth year'
);
select is(
  (select birth_year from athlete where organization_id = 982 and athlete_no = 1),
  1990,
  'the same number in another Organization is untouched'
);
select is(
  (select count(*)::integer from athlete where organization_id = 981),
  3,
  'an unknown number never creates an athlete'
);
select is(
  (select full_name from athlete where organization_id = 981 and athlete_no = 1),
  'First Athlete',
  'names are not updated'
);
select results_eq(
  $$ select organization_id, league_id, actor, entity, action, before, after from audit_log where organization_id = 981 $$,
  $$ select 981, null::integer, 'admin@ages.test', 'athlete', 'athlete.ages-uploaded', null::jsonb,
            '{"year_taken": 2026, "rows": 3, "updated": 2, "unknown": 1}'::jsonb $$,
  'one Organization-scoped audit row records the upload'
);

-- Bad input is rejected whole, whatever a client sends.

set local role authenticated;
select throws_ok(
  $$ select public.save_athlete_ages(981, 2026, '[{"athlete_no": 1, "birth_year": 2022}]') $$,
  '22023', 'An age must be between 5 and 100',
  'an implausible age is rejected'
);
select throws_ok(
  format(
    $$ select public.save_athlete_ages(981, %s, '[]') $$,
    extract(year from now())::integer + 1
  ),
  '22023', 'The year the ages were taken can''t be in the future',
  'a future year is rejected'
);
reset role;

select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 1),
  1990,
  'rejected input writes nothing'
);

select * from finish();
rollback;
