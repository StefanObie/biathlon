-- Correcting one athlete's age (#81): an Official of the Organization gives an
-- age and birth_year becomes the current year minus it, with an audit row.
-- correct_athlete_age is the only way anyone signed in can write birth_year.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into organization (id, name) overriding system value values
  (971, 'Age Org'),
  (972, 'Other Org');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (971, 'League 1', '2027-01-10', 2027, 971),
  (972, 'League 2', '2027-01-17', 2027, 971),
  (973, 'Other League', '2027-01-10', 2027, 972);

insert into athlete (organization_id, athlete_no, full_name, gender, birth_year) values
  (971, 1, 'Has Birth Year', 'F', 1980),
  (971, 2, 'No Birth Year', 'M', null),
  (972, 1, 'Other Athlete', 'F', 1990);

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (971, 1, 1, 1, 1, 'M40'),
  (972, 1, 1, 1, 1, 'M40'),
  (973, 1, 1, 1, 1, 'M40');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'official@age.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'timekeeper@age.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'admin@age.test');
insert into organization_member (organization_id, user_id, is_admin) values
  (971, '00000000-0000-0000-0000-0000000000d1', false),
  (971, '00000000-0000-0000-0000-0000000000d2', false),
  (971, '00000000-0000-0000-0000-0000000000d3', true);
-- The Official is on the team of League 971 only.
insert into league_team_member (league_id, user_id, role) values
  (971, '00000000-0000-0000-0000-0000000000d1', 'official'),
  (971, '00000000-0000-0000-0000-0000000000d2', 'timekeeper');

---------------------------------------------------------------------------
-- An Official corrects an age.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "email": "official@age.test", "role": "authenticated"}';

-- The Leagues to refresh include one the Official isn't on, by id, so a
-- Protected League's secret slug never reaches them.
select is(
  public.correct_athlete_age(971, 1, 45),
  array[971, 972],
  'an Official corrects an age and gets the Leagues the athlete is entered in'
);

reset role;

create temporary table this_year as
  select extract(year from now() at time zone 'Africa/Johannesburg')::integer as y;
grant select on this_year to authenticated;

select is(
  (select birth_year from athlete where organization_id = 971 and athlete_no = 1),
  (select y - 45 from this_year),
  'the age is stored as the current year minus the age'
);
select is(
  (select birth_year from athlete where organization_id = 972 and athlete_no = 1),
  1990,
  'an athlete with the same number in another Organization is untouched'
);
select results_eq(
  $$ select organization_id, league_id, actor, entity, action,
            before, after - 'age', (after ->> 'age')::integer
     from audit_log where entity = 'athlete' and organization_id = 971 $$,
  $$ select 971, null::integer, 'official@age.test', 'athlete', 'athlete.age-corrected',
            '{"athlete_no": 1, "birth_year": 1980}'::jsonb,
            jsonb_build_object('athlete_no', 1, 'birth_year', y - 45),
            45
     from this_year $$,
  'the correction writes one audit row with the before and after values'
);

---------------------------------------------------------------------------
-- An athlete with no birth year can be given one, and an Admin can too.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d3", "email": "admin@age.test", "role": "authenticated"}';

select lives_ok(
  $$ select public.correct_athlete_age(971, 2, 30) $$,
  'an Admin covers Official, and an athlete with no birth year can get one'
);

reset role;

select is(
  (select before ->> 'birth_year' from audit_log
   where entity = 'athlete' and organization_id = 971 and after ->> 'athlete_no' = '2'),
  null,
  'the audit row of a first age has an empty before value'
);

---------------------------------------------------------------------------
-- Bad input is rejected with a clear message, and nothing is written.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "email": "official@age.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.correct_athlete_age(971, 1, 4) $$,
  '22023', 'Age must be between 5 and 100.',
  'an age below the plausible range is rejected'
);
select throws_ok(
  $$ select public.correct_athlete_age(971, 1, 101) $$,
  '22023', 'Age must be between 5 and 100.',
  'an age above the plausible range is rejected'
);
select lives_ok(
  $$ select public.correct_athlete_age(971, 1, 100) $$,
  'the top of the plausible range is accepted'
);
select throws_ok(
  $$ select public.correct_athlete_age(971, 999, 40) $$,
  '22023', 'Athlete 999 is not an athlete of this organization',
  'an unknown athlete number is rejected'
);

---------------------------------------------------------------------------
-- Who can't write a birth year.
---------------------------------------------------------------------------

select throws_ok(
  $$ select public.correct_athlete_age(972, 1, 40) $$,
  '42501', null,
  'an Official of another Organization cannot correct an age'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "email": "timekeeper@age.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.correct_athlete_age(971, 1, 40) $$,
  '42501', null,
  'a Timekeeper cannot correct an age'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select public.correct_athlete_age(971, 1, 40) $$,
  '42501', null,
  'an anonymous visitor cannot correct an age'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "email": "official@age.test", "role": "authenticated"}';

-- Direct writes would skip the audit log, so not even an Official can make one.
select throws_ok(
  $$ update athlete set birth_year = 2000 where organization_id = 971 and athlete_no = 1 $$,
  '42501', null,
  'an Official cannot update a birth year directly'
);
select throws_ok(
  $$ insert into athlete (organization_id, athlete_no, full_name, gender, birth_year)
     values (971, 3, 'New Athlete', 'M', 2000) $$,
  '42501', null,
  'an Official cannot insert a birth year directly'
);

-- The start list import still upserts the other columns. PostgREST sets every
-- column it was sent, the primary key included.
select lives_ok(
  $$ insert into athlete (organization_id, athlete_no, full_name, gender)
     values (971, 2, 'Renamed Athlete', 'M')
     on conflict (organization_id, athlete_no)
     do update set organization_id = excluded.organization_id,
                   athlete_no = excluded.athlete_no,
                   full_name = excluded.full_name,
                   gender = excluded.gender $$,
  'an Official can still add and update an athlete''s other details'
);

select * from finish();
rollback;
