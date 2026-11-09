-- Which Run result counts on the public results (and so on Medals, which
-- reads the same published times) when an athlete has an Off-roster run
-- (#97, ADR 0008): an ok one beats one that isn't, then the roster heat's,
-- then the lowest-numbered heat's.
--
-- One public League with heats 1, 5 and 7 all Closed.

begin;
create extension if not exists pgtap with schema extensions;

select plan(1);

insert into organization (id, name) overriding system value values
  (971, 'Off-roster Org');

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (971, 'Off-roster League', '2027-03-01', 2027, 971, 'public', 'off-roster-league');

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (971, 1, 'Roster Heat Wins', 'F'),
  (971, 2, 'Ok Beats DNS', 'F'),
  (971, 3, 'Lowest Heat Wins', 'F'),
  (971, 4, 'Only Off-roster', 'F');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (971, 1, 7, 1, 1, 'U13'),
  (971, 2, 1, 1, 2, 'U13'),
  (971, 3, 1, 1, 3, 'U13'),
  (971, 4, 1, 1, 4, 'U13');

insert into league_race (league_id, run_heat, started_at, device_id, closed_at, closed_by) values
  (971, 1, now(), 'dev', now(), 'official'),
  (971, 5, now(), 'dev', now(), 'official'),
  (971, 7, now(), 'dev', now(), 'official');

insert into run_result (league_id, athlete_no, run_heat, run_time, status, source) values
  (971, 1, 5, '03:05.00', 'ok', 'reconcile'),
  (971, 1, 7, '03:07.00', 'ok', 'reconcile'),
  (971, 2, 1, null, 'dns', 'reconcile'),
  (971, 2, 7, '03:17.00', 'ok', 'reconcile'),
  (971, 3, 7, '03:37.00', 'ok', 'reconcile'),
  (971, 3, 5, '03:35.00', 'ok', 'reconcile'),
  (971, 4, 7, '03:47.00', 'ok', 'reconcile');

select results_eq(
  $$ select a ->> 'full_name', a ->> 'run_time'
     from jsonb_array_elements(public.league_results('off-roster-league') -> 'athletes') a
     order by a ->> 'full_name' $$,
  $$ values ('Lowest Heat Wins', '03:35.00'),
            ('Ok Beats DNS', '03:17.00'),
            ('Only Off-roster', '03:47.00'),
            ('Roster Heat Wins', '03:07.00') $$,
  'Public: only ok Run results with a time count, the roster heat before the lowest-numbered heat'
);

select * from finish();
rollback;
