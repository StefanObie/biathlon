-- A Late entry's age (#83): an Official of the League can give one, and
-- birth_year becomes the year of the League date minus it, with an audit row.
-- It is saved only for an athlete with no birth year, and never overwrites one.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into organization (id, name) overriding system value values
  (981, 'Late Age Org');

-- The League date's year differs from the current year and from the season.
insert into league (id, name, league_date, season, organization_id) overriding system value values
  (981, 'League 1', '2031-01-10', 2029, 981),
  (982, 'League 2', '2031-02-10', 2029, 981);

insert into athlete (organization_id, athlete_no, full_name, gender, birth_year) values
  (981, 1, 'No Birth Year', 'F', null),
  (981, 2, 'Has Birth Year', 'M', 1980),
  (981, 3, 'Left Blank', 'M', null),
  (981, 4, 'Not Entered', 'M', null),
  (981, 5, 'Bad Age', 'M', null);

insert into entry (league_id, athlete_no, run_heat, age_group_code) values
  (981, 1, 1, 'M40'),
  (982, 1, 1, 'M40'),
  (981, 2, 1, 'M40'),
  (981, 5, 1, 'M40');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'official@lateage.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'timekeeper@lateage.test');
insert into organization_member (organization_id, user_id, is_admin) values
  (981, '00000000-0000-0000-0000-0000000000e1', false),
  (981, '00000000-0000-0000-0000-0000000000e2', false);
-- The Official is on the team of League 981 only.
insert into league_team_member (league_id, user_id, role) values
  (981, '00000000-0000-0000-0000-0000000000e1', 'official'),
  (981, '00000000-0000-0000-0000-0000000000e2', 'timekeeper');

---------------------------------------------------------------------------
-- An Official gives an athlete with no birth year an age.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "email": "official@lateage.test", "role": "authenticated"}';

-- Every League the athlete is entered in needs refreshing, by id, including
-- one the Official isn't on.
select is(
  public.set_late_entry_age(981, 1, 45),
  array[981, 982],
  'setting a birth year returns the Leagues to refresh'
);

select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 1),
  1986,
  'the birth year is the year of the League date minus the age'
);

reset role;

select is(
  (select count(*)::integer from audit_log
   where organization_id = 981 and action = 'athlete.late-entry-age-set'
     and actor = 'official@lateage.test'),
  1,
  'setting a birth year writes an Organization audit row'
);
select is(
  (select before from audit_log where organization_id = 981 and action = 'athlete.late-entry-age-set'),
  '{"athlete_no": 1, "birth_year": null}'::jsonb,
  'the audit row holds the empty birth year'
);
select is(
  (select after from audit_log where organization_id = 981 and action = 'athlete.late-entry-age-set'),
  '{"athlete_no": 1, "birth_year": 1986, "age": 45, "league_id": 981}'::jsonb,
  'the audit row holds the new birth year, the age and the League'
);

---------------------------------------------------------------------------
-- It never overwrites an existing birth year.
---------------------------------------------------------------------------

set local role authenticated;

select is(
  public.set_late_entry_age(981, 2, 30),
  '{}'::integer[],
  'an athlete with a birth year has no Leagues to refresh'
);

reset role;

select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 2),
  1980,
  'an existing birth year is not overwritten'
);
select is(
  (select count(*)::integer from audit_log
   where organization_id = 981 and action = 'athlete.late-entry-age-set'),
  1,
  'a birth year left alone writes no audit row'
);

---------------------------------------------------------------------------
-- A Late entry without an age leaves the birth year empty.
---------------------------------------------------------------------------

set local role authenticated;

select lives_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, age_group_code)
     values (981, 3, 1, 'M40') $$,
  'a Late entry saves with no age'
);

reset role;

select is(
  (select birth_year from athlete where organization_id = 981 and athlete_no = 3),
  null::integer,
  'a Late entry with no age leaves the birth year empty'
);

---------------------------------------------------------------------------
-- An implausible age is rejected.
---------------------------------------------------------------------------

set local role authenticated;

select throws_ok(
  $$ select public.set_late_entry_age(981, 5, 4) $$,
  '22023', 'Age must be between 5 and 100.',
  'an age under 5 is rejected'
);
select throws_ok(
  $$ select public.set_late_entry_age(981, 5, 101) $$,
  '22023', 'Age must be between 5 and 100.',
  'an age over 100 is rejected'
);
select throws_ok(
  $$ select public.set_late_entry_age(981, 5, null) $$,
  '22023', 'Age must be between 5 and 100.',
  'no age at all is rejected'
);
select lives_ok(
  $$ select public.set_late_entry_age(981, 5, 100) $$,
  'an age of 100 is accepted'
);

---------------------------------------------------------------------------
-- Only for an athlete entered in the League, by an Official of that League.
---------------------------------------------------------------------------

select throws_ok(
  $$ select public.set_late_entry_age(981, 4, 30) $$,
  '22023', '#4 is not on the Start list',
  'an athlete not entered in the League is rejected'
);
select throws_ok(
  $$ select public.set_late_entry_age(982, 1, 30) $$,
  '42501', 'Only an Official of this League can give a Late entry''s age',
  'an Official of another League is rejected'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e2", "email": "timekeeper@lateage.test", "role": "authenticated"}';

select throws_ok(
  $$ select public.set_late_entry_age(981, 3, 30) $$,
  '42501', 'Only an Official of this League can give a Late entry''s age',
  'a Timekeeper is rejected'
);

set local role anon;
set local request.jwt.claims = '{}';

select throws_ok(
  $$ select public.set_late_entry_age(981, 3, 30) $$,
  '42501', null,
  'anyone signed out is rejected'
);

select * from finish();
rollback;
