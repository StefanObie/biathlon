-- Athletes belong to an Organization (#31, ADR 0002).
--
-- Organizations A and B each hold Athlete number 7 under a different name,
-- and each has one League with that athlete entered.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'member-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'member-b@example.com');

insert into organization (id, name) overriding system value values
  (901, 'Organization A'),
  (902, 'Organization B');

insert into organization_member (organization_id, user_id) values
  (901, '00000000-0000-0000-0000-00000000000a'),
  (902, '00000000-0000-0000-0000-00000000000b');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (901, 'League A', '2026-01-01', 2026, 901),
  (902, 'League B', '2026-01-01', 2026, 902);

insert into league_team_member (league_id, user_id, role) values
  (901, '00000000-0000-0000-0000-00000000000a', 'official'),
  (902, '00000000-0000-0000-0000-00000000000b', 'official');

select lives_ok(
  $$
    insert into athlete (organization_id, athlete_no, full_name, gender) values
      (901, 7, 'Anna of A', 'F'),
      (902, 7, 'Ben of B', 'M')
  $$,
  'two organizations can each hold the same athlete number'
);

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (902, 8, 'Only in B', 'M');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (901, 7, 1, 1, 1, 'U13'),
  (902, 7, 1, 1, 1, 'U13');

-- The Organization on a league's rows always follows the League, whatever
-- the writer sent, so the athlete is resolved inside the League's
-- Organization.

select results_eq(
  $$ select organization_id from entry where league_id = 901 $$,
  $$ values (901) $$,
  'an entry takes its league''s organization'
);

select throws_ok(
  $$ insert into entry (league_id, organization_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values (901, 902, 8, 1, 1, 2, 'U13') $$,
  '23503', null,
  'an entry can''t reference another organization''s athlete, even by naming that organization'
);

select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-x', 901, 1, 1, 8, 'dev', now()) $$,
  '23503', null,
  'a position scan resolves the athlete in the league''s organization only'
);

select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-skip', 901, 1, 1, null, 'dev', now()) $$,
  'a Skip still needs no athlete'
);

select throws_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (901, 8, 1, '05:00.00', 'auto') $$,
  '23503', null,
  'a run result resolves the athlete in the league''s organization only'
);

select throws_ok(
  $$ insert into swim_result (league_id, athlete_no, event_no, heat, lane, swim_time, source) values (901, 8, 1, 1, 1, '01:00.00', 'import') $$,
  '23503', null,
  'a swim result resolves the athlete in the league''s organization only'
);

---------------------------------------------------------------------------
-- An Official of A sees only A's athletes.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select full_name from athlete $$,
  $$ values ('Anna of A') $$,
  'a Member of A reads only A''s athletes'
);

select results_eq(
  $$ select a.full_name from entry e join athlete a using (organization_id, athlete_no) where e.league_id = 901 $$,
  $$ values ('Anna of A') $$,
  'League A''s entry resolves to A''s athlete 7'
);

select throws_ok(
  $$ insert into athlete (organization_id, athlete_no, full_name, gender) values (902, 9, 'Planted in B', 'M') $$,
  '42501', null,
  'a Member of A can''t add an athlete to B'
);

select is_empty(
  $$ update athlete set full_name = 'Renamed' where organization_id = 902 returning 1 $$,
  'a Member of A can''t rename B''s athletes'
);

reset role;

select * from finish();
rollback;
