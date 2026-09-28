-- Who can read and write what across Organizations (#29).
--
-- Organization A has an Admin and a plain Member; Organization B has one
-- Member; one more user belongs to no Organization. League A and League B
-- each have a row in every league-scoped table. Each block below acts as
-- one of those users and checks what they can see and change.

begin;
create extension if not exists pgtap with schema extensions;

select plan(60);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin-a@example.com'),
  ('00000000-0000-0000-0000-0000000000aa', 'member-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'member-b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'nobody@example.com');

insert into organization (id, name) overriding system value values
  (901, 'Organization A'),
  (902, 'Organization B');

insert into organization_member (organization_id, user_id, is_admin) values
  (901, '00000000-0000-0000-0000-00000000000a', true),
  (901, '00000000-0000-0000-0000-0000000000aa', false),
  (902, '00000000-0000-0000-0000-00000000000b', false);

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (901, 'League A', '2026-01-01', 2026, 901),
  (902, 'League B', '2026-01-01', 2026, 902);

insert into athlete (athlete_no, full_name, gender) values
  (9001, 'Test Athlete', 'M');

insert into points_table (
  effective_from, gender, age_group_code, age_group_label, sort_order, age_from, age_to,
  run_distance_m, run_base_time, run_points_per_second,
  swim_distance_m, swim_base_time, swim_points_per_second, bonus_points_per_year
) values ('1900-01-01', 'M', 'TST', 'Test', 1, 0, 99, 1000, '05:00.00', 1, 100, '01:00.00', 1, 0);

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (901, 9001, 1, 1, 1, 'U13'),
  (902, 9001, 1, 1, 1, 'U13');

insert into league_race (league_id, run_heat, started_at, device_id) values
  (901, 1, now(), 'dev'),
  (902, 1, now(), 'dev');

insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values
  ('tc-a', 901, 1, 1, '05:00.00', 'dev', now()),
  ('tc-b', 902, 1, 1, '05:00.00', 'dev', now());

insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values
  ('pc-a', 901, 1, 1, 9001, 'dev', now()),
  ('pc-b', 902, 1, 1, 9001, 'dev', now());

insert into run_result (league_id, athlete_no, run_heat, run_time, source) values
  (901, 9001, 1, '05:00.00', 'auto'),
  (902, 9001, 1, '05:00.00', 'auto');

insert into swim_result (league_id, athlete_no, event_no, heat, lane, swim_time, source) values
  (901, 9001, 1, 1, 1, '01:00.00', 'import'),
  (902, 9001, 1, 1, 1, '01:00.00', 'import');

insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values
  ('on-a', 901, 1, 0, 'timer', 'note', 'dev', now()),
  ('on-b', 902, 1, 0, 'timer', 'note', 'dev', now());

insert into audit_log (league_id, actor, entity, action) values
  (901, 'someone', 'league_race', 'close'),
  (902, 'someone', 'league_race', 'close');

-- A League's Organization can't be changed, not even by the table owner.

select throws_ok(
  $$ update league set organization_id = 902 where id = 901 $$,
  'P0001',
  'A league''s organization cannot be changed',
  'the database refuses to change a league''s organization'
);

---------------------------------------------------------------------------
-- A Member of Organization B can't read or write anything of Organization A.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select results_eq(
  $$ select name from organization $$,
  $$ values ('Organization B') $$,
  'a Member sees only their own organization'
);
select is_empty(
  $$ select 1 from organization_member where organization_id = 901 $$,
  'a Member of B sees no memberships of A'
);
select results_eq(
  $$ select id from league $$,
  $$ values (902) $$,
  'a Member of B sees League B but not League A'
);
select is_empty($$ select 1 from entry where league_id = 901 $$, 'B can''t read A''s entries');
select is_empty($$ select 1 from league_race where league_id = 901 $$, 'B can''t read A''s league races');
select is_empty($$ select 1 from time_capture where league_id = 901 $$, 'B can''t read A''s time captures');
select is_empty($$ select 1 from position_capture where league_id = 901 $$, 'B can''t read A''s position captures');
select is_empty($$ select 1 from run_result where league_id = 901 $$, 'B can''t read A''s run results');
select is_empty($$ select 1 from swim_result where league_id = 901 $$, 'B can''t read A''s swim results');
select is_empty($$ select 1 from operator_note where league_id = 901 $$, 'B can''t read A''s operator notes');
select is_empty($$ select 1 from audit_log where league_id = 901 $$, 'B can''t read A''s audit log');

select isnt_empty($$ select 1 from entry where league_id = 902 $$, 'B reads its own entries');
select isnt_empty($$ select 1 from time_capture where league_id = 902 $$, 'B reads its own time captures');
select isnt_empty($$ select 1 from audit_log where league_id = 902 $$, 'B reads its own audit log');

select throws_ok(
  $$ insert into league (name, league_date, season, organization_id) values ('Sneaky', '2026-01-01', 2026, 901) $$,
  '42501', null, 'B can''t create a league in A'
);
select throws_ok(
  $$ insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values (901, 9001, 2, 1, 2, 'U13') $$,
  '42501', null, 'B can''t add an entry to A'
);
select throws_ok(
  $$ insert into league_race (league_id, run_heat, started_at, device_id) values (901, 2, now(), 'dev') $$,
  '42501', null, 'B can''t start a heat in A'
);
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-x', 901, 1, 2, '05:01.00', 'dev', now()) $$,
  '42501', null, 'B can''t add a time capture to A'
);
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-x', 901, 1, 2, null, 'dev', now()) $$,
  '42501', null, 'B can''t add a position capture to A'
);
select throws_ok(
  $$ insert into run_result (league_id, athlete_no, run_heat, run_time, source) values (901, 9001, 2, '05:00.00', 'manual') $$,
  '42501', null, 'B can''t add a run result to A'
);
select throws_ok(
  $$ insert into swim_result (league_id, athlete_no, event_no, heat, lane, swim_time, source) values (901, 9001, 2, 1, 1, '01:00.00', 'manual') $$,
  '42501', null, 'B can''t add a swim result to A'
);
select throws_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at) values ('on-x', 901, 1, 0, 'timer', 'note', 'dev', now()) $$,
  '42501', null, 'B can''t add an operator note to A'
);
select throws_ok(
  $$ insert into audit_log (league_id, actor, entity, action) values (901, 'b', 'league_race', 'close') $$,
  '42501', null, 'B can''t write to A''s audit log'
);

-- Updates and deletes of A's rows match nothing for B; checked below as the
-- table owner.
update league set name = 'Hijacked' where id = 901;
delete from league where id = 901;
update entry set run_heat = 9 where league_id = 901;
delete from entry where league_id = 901;
update league_race set closed_at = now(), closed_by = 'b' where league_id = 901;
delete from league_race where league_id = 901;
update time_capture set voided = true where league_id = 901;
delete from time_capture where league_id = 901;
update position_capture set voided = true where league_id = 901;
delete from position_capture where league_id = 901;
update run_result set status = 'dq' where league_id = 901;
delete from run_result where league_id = 901;
update swim_result set status = 'dq' where league_id = 901;
delete from swim_result where league_id = 901;
update audit_log set reason = 'tampered' where league_id = 901;
delete from audit_log where league_id = 901;

reset role;

select results_eq(
  $$
    select
      (select name from league where id = 901),
      (select run_heat from entry where league_id = 901),
      (select closed_at is null from league_race where league_id = 901),
      (select voided from time_capture where id = 'tc-a'),
      (select voided from position_capture where id = 'pc-a'),
      (select status from run_result where league_id = 901),
      (select status from swim_result where league_id = 901),
      (select reason is null from audit_log where league_id = 901)
  $$,
  $$ values ('League A', 1, true, false, false, 'ok', 'ok', true) $$,
  'B''s updates and deletes left A''s data untouched'
);

---------------------------------------------------------------------------
-- A user with no membership sees nothing.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is_empty($$ select 1 from organization $$, 'no membership: no organizations');
select is_empty($$ select 1 from organization_member $$, 'no membership: no memberships');
select is_empty($$ select 1 from league $$, 'no membership: no leagues');
select is_empty($$ select 1 from entry $$, 'no membership: no entries');
select is_empty($$ select 1 from league_race $$, 'no membership: no league races');
select is_empty($$ select 1 from time_capture $$, 'no membership: no time captures');
select is_empty($$ select 1 from position_capture $$, 'no membership: no position captures');
select is_empty($$ select 1 from run_result $$, 'no membership: no run results');
select is_empty($$ select 1 from swim_result $$, 'no membership: no swim results');
select is_empty($$ select 1 from operator_note $$, 'no membership: no operator notes');
select is_empty($$ select 1 from audit_log $$, 'no membership: no audit log');
select isnt_empty($$ select 1 from points_table $$, 'no membership: the points table is still readable');

---------------------------------------------------------------------------
-- A Member of Organization A (not an Admin) works on A's League.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';

select results_eq(
  $$ select id from league $$,
  $$ values (901) $$,
  'a Member of A sees League A only'
);
select isnt_empty($$ select 1 from operator_note where league_id = 901 $$, 'a Member of A reads A''s operator notes');
select isnt_empty($$ select 1 from swim_result where league_id = 901 $$, 'a Member of A reads A''s swim results');
select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-a2', 901, 1, 2, '05:01.00', 'dev', now()) $$,
  'a Member of A adds a time capture to A'
);
select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values ('pc-a2', 901, 1, 2, null, 'dev', now()) $$,
  'a Member of A adds a position capture to A'
);
select lives_ok(
  $$ update league_race set closed_at = now(), closed_by = 'a' where league_id = 901 and run_heat = 1 $$,
  'a Member of A closes a heat in A'
);
select lives_ok(
  $$ insert into audit_log (league_id, actor, entity, action) values (901, 'a', 'league_race', 'close') $$,
  'a Member of A writes to A''s audit log'
);
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-a3', 902, 1, 2, '05:01.00', 'dev', now()) $$,
  '42501', null, 'a Member of A can''t add a time capture to B'
);
select throws_ok(
  $$ insert into league (name, league_date, season, organization_id) values ('New', '2026-02-01', 2026, 901) $$,
  '42501', null, 'a Member who isn''t an Admin can''t create a league'
);
select is_empty(
  $$ update league set name = 'Renamed' where id = 901 returning 1 $$,
  'a Member who isn''t an Admin can''t rename a league'
);
select is_empty(
  $$ delete from league where id = 901 returning 1 $$,
  'a Member who isn''t an Admin can''t delete a league'
);

---------------------------------------------------------------------------
-- An Admin of Organization A creates Leagues, only in A.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ insert into league (name, league_date, season, organization_id) values ('League A2', '2026-02-01', 2026, 901) $$,
  'an Admin creates a league in their organization'
);
select results_eq(
  $$ select name from league order by name $$,
  $$ values ('League A'), ('League A2') $$,
  'the new league is visible to the Admin'
);
select throws_ok(
  $$ insert into league (name, league_date, season, organization_id) values ('League B2', '2026-02-01', 2026, 902) $$,
  '42501', null, 'an Admin of A can''t create a league in B'
);
select results_eq(
  $$ update league set name = 'League A (renamed)' where id = 901 returning name $$,
  $$ values ('League A (renamed)') $$,
  'an Admin can rename their league'
);
select throws_ok(
  $$ update league set organization_id = 902 where id = 901 $$,
  null, null, 'an Admin can''t move a league to another organization'
);
select results_eq(
  $$ select count(*)::int from organization_member $$,
  $$ values (2) $$,
  'an Admin sees their own organization''s memberships only'
);

---------------------------------------------------------------------------
-- Anonymous users are denied everything.
---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty($$ select 1 from organization $$, 'anon: no organizations');
select is_empty($$ select 1 from league $$, 'anon: no leagues');
select is_empty($$ select 1 from entry $$, 'anon: no entries');
select is_empty($$ select 1 from time_capture $$, 'anon: no time captures');
select is_empty($$ select 1 from audit_log $$, 'anon: no audit log');
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values ('tc-anon', 901, 1, 3, '05:02.00', 'dev', now()) $$,
  '42501', null, 'anon can''t add a time capture'
);

reset role;

select * from finish();
rollback;
