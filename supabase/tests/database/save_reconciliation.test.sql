-- Saving a heat's Reconciliation (#69, ADR 0006): the saved table is stored
-- as the heat's record, its Run results are exactly the athletes on it, the
-- heat closes, and a Closed heat can't be saved until it is reopened.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into organization (id, name) overriding system value values
  (691, 'Reconciliation Org');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (691, 'League 1', '2027-02-01', 2027, 691);

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (691, 12, 'Scanned Athlete', 'M'),
  (691, 34, 'Actual Athlete', 'M'),
  (691, 56, 'Added Athlete', 'F');

insert into entry (league_id, athlete_no, run_heat, age_group_code) values
  (691, 12, 1, 'U13'),
  (691, 34, 1, 'U13'),
  (691, 56, 1, 'U13');

insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values
  ('p1', 691, 1, 1, 12, 'dev', now());
insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values
  ('t1', 691, 1, 1, '02:31.10', 'dev', now()),
  ('t2', 691, 1, 2, '02:40.00', 'dev', now());

-- An earlier save gave the scanned #12 the time; it was the wrong athlete.
insert into run_result (league_id, athlete_no, run_heat, run_time, source) values
  (691, 12, 1, '02:31.10', 'manual');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000069101', 'official@reconcile.test'),
  ('00000000-0000-0000-0000-000000069102', 'placer@reconcile.test');
insert into organization_member (organization_id, user_id, is_admin) values
  (691, '00000000-0000-0000-0000-000000069101', false),
  (691, '00000000-0000-0000-0000-000000069102', false);
insert into league_team_member (league_id, user_id, role) values
  (691, '00000000-0000-0000-0000-000000069101', 'official'),
  (691, '00000000-0000-0000-0000-000000069102', 'placer');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000069101", "role": "authenticated", "email": "official@reconcile.test"}';

-- The scan said #12, but #34 finished first; #56 was added by hand.
select public.save_reconciliation(691, 1, $$[
  {"athlete_no": 34, "run_time": "02:30.90", "status": "ok", "position_capture_id": "p1", "time_capture_id": "t1"},
  {"athlete_no": 56, "run_time": "02:40.00", "status": "ok", "position_capture_id": null, "time_capture_id": "t2"}
]$$::jsonb);

select results_eq(
  $$ select row_no, athlete_no, run_time, status, position_capture_id, time_capture_id
     from reconciliation_row where league_id = 691 and run_heat = 1 order by row_no $$,
  $$ values (1, 34, '02:30.90', 'ok', 'p1', 't1'),
            (2, 56, '02:40.00', 'ok', null, 't2') $$,
  'the saved Reconciliation is stored in order, with the Captures each row came from'
);

select results_eq(
  $$ select athlete_no, run_time, status from run_result
     where league_id = 691 and run_heat = 1 order by athlete_no $$,
  $$ values (34, '02:30.90', 'ok'), (56, '02:40.00', 'ok') $$,
  'the heat''s Run results are exactly the athletes in the saved Reconciliation'
);

select results_eq(
  $$ select closed_at is not null, closed_by from league_race
     where league_id = 691 and run_heat = 1 $$,
  $$ values (true, 'official@reconcile.test') $$,
  'saving closes the heat'
);

select results_eq(
  $$ select actor, before -> 'run_results' -> 0 ->> 'athlete_no',
            jsonb_array_length(before -> 'reconciliation'),
            jsonb_array_length(after -> 'reconciliation'),
            jsonb_array_length(after -> 'run_results')
     from audit_log
     where league_id = 691 and entity = 'reconciliation' and action = 'reconcile-save' $$,
  $$ values ('official@reconcile.test', '12', 0, 2, 2) $$,
  'one audit entry records the Reconciliation and Run results before and after'
);

select is(
  (select count(*)::integer from audit_log
   where league_id = 691 and entity = 'league_race' and action = 'close'),
  1,
  'the close is audited'
);

select throws_ok(
  $$ select public.save_reconciliation(691, 1, '[]'::jsonb) $$,
  '42501', null,
  'a Closed heat can''t be saved until it is reopened'
);

update league_race set closed_at = null, closed_by = null
where league_id = 691 and run_heat = 1;

select throws_ok(
  $$ select public.save_reconciliation(691, 1, '[
       {"athlete_no": 34, "run_time": "02:30.90", "status": "ok"},
       {"athlete_no": 34, "run_time": "02:40.00", "status": "ok"}
     ]'::jsonb) $$,
  '23505', null,
  'an athlete can''t be on two rows of a Reconciliation'
);

select lives_ok(
  $$ select public.save_reconciliation(691, 1, '[
       {"athlete_no": 34, "run_time": null, "status": "dnf"}
     ]'::jsonb) $$,
  'a reopened heat can be saved again'
);

select results_eq(
  $$ select athlete_no, run_time, status from run_result
     where league_id = 691 and run_heat = 1 $$,
  $$ values (34, null::text, 'dnf') $$,
  'saving the reopened heat replaces its Run results'
);

select throws_ok(
  $$ insert into reconciliation_row (league_id, run_heat, row_no, athlete_no)
     values (691, 2, 1, 34) $$,
  '42501', null,
  'a Reconciliation is only written by saving it'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000069102", "role": "authenticated", "email": "placer@reconcile.test"}';

select throws_ok(
  $$ select public.save_reconciliation(691, 2, '[]'::jsonb) $$,
  '42501', null,
  'only an Official saves a Reconciliation'
);

select * from finish();
rollback;
