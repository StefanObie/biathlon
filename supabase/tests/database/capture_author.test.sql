-- Captures and operator notes record their author, and a capture that
-- syncs late is judged by the Role its author held when they made it (#36).
--
-- Organization A runs League 1. On its team are a Timekeeper and a Placer
-- who are still there, and a Timekeeper and a Placer who were on it from
-- two hours ago until an hour ago. Someone who was a Timekeeper over that
-- same hour never held Placer, and one more Member was never on the team.

begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'timekeeper@author.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'placer@author.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'removed-timekeeper@author.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'removed-placer@author.test'),
  ('00000000-0000-0000-0000-000000000099', 'bystander@author.test');

insert into organization (id, name) overriding system value values
  (911, 'Organization A');

insert into organization_member (organization_id, user_id, is_admin) values
  (911, '00000000-0000-0000-0000-0000000000e1', false),
  (911, '00000000-0000-0000-0000-0000000000d1', false),
  (911, '00000000-0000-0000-0000-0000000000e2', false),
  (911, '00000000-0000-0000-0000-0000000000d2', false),
  (911, '00000000-0000-0000-0000-000000000099', false);

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (911, 'League 1', '2026-01-01', 2026, 911);

insert into athlete (organization_id, athlete_no, full_name, gender) values
  (911, 7, 'Test Athlete', 'M');

-- The team's history is written with its real times, which the history
-- trigger would otherwise replace with now().
alter table league_team_member disable trigger league_team_member_keeps_history;
insert into league_team_member (league_id, user_id, role, started_at, ended_at) values
  (911, '00000000-0000-0000-0000-0000000000e1', 'timekeeper', now() - interval '2 hours', null),
  (911, '00000000-0000-0000-0000-0000000000d1', 'placer', now() - interval '2 hours', null),
  (911, '00000000-0000-0000-0000-0000000000e2', 'timekeeper', now() - interval '2 hours', now() - interval '1 hour'),
  (911, '00000000-0000-0000-0000-0000000000d2', 'placer', now() - interval '2 hours', now() - interval '1 hour');
alter table league_team_member enable trigger league_team_member_keeps_history;

-- A capture from before #36, written without a session.
insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at) values
  ('tc-old', 911, 1, 1, '05:00.00', 'dev', now() - interval '3 hours');

select is(
  (select author_id from time_capture where id = 'tc-old'), null,
  'a capture written without a session has no author'
);

---------------------------------------------------------------------------
-- A Timekeeper still on the team.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}';

select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at, author_id)
     values ('tc-tk', 911, 1, 2, '05:01.00', 'dev', now(), '00000000-0000-0000-0000-0000000000d1') $$,
  'a Timekeeper adds a time capture'
);
select is(
  (select author_id from time_capture where id = 'tc-tk'), '00000000-0000-0000-0000-0000000000e1'::uuid,
  'a time capture''s author is the session''s user, not whoever the phone named'
);
select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at)
     values ('tc-tk-skew', 911, 1, 3, '05:02.00', 'dev', now() - interval '1 day') $$,
  'a Timekeeper on the team now adds a capture whose phone clock reads before they joined'
);
select lives_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at)
     values ('on-tk', 911, 1, 0, 'timer', 'note', 'dev', now()) $$,
  'a Timekeeper adds an operator note'
);
select is(
  (select author_id from operator_note where id = 'on-tk'), '00000000-0000-0000-0000-0000000000e1'::uuid,
  'an operator note''s author is the session''s user'
);
select lives_ok(
  $$ update time_capture set voided = true, void_reason = 'undo' where id = 'tc-old' $$,
  'a Timekeeper voids a capture from before #36'
);

reset role;

select is(
  (select author_id from time_capture where id = 'tc-old'), null,
  'voiding a capture from before #36 leaves it without an author'
);

---------------------------------------------------------------------------
-- A Placer still on the team.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';

select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at)
     values ('pc-pl', 911, 1, 1, 7, 'dev', now()) $$,
  'a Placer adds a position capture'
);
select is(
  (select author_id from position_capture where id = 'pc-pl'), '00000000-0000-0000-0000-0000000000d1'::uuid,
  'a position capture''s author is the session''s user'
);

reset role;

---------------------------------------------------------------------------
-- The removed Timekeeper, whose phone syncs late.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated"}';

-- Upserted, as the phones sync.
select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at)
     values ('tc-late', 911, 1, 4, '05:03.00', 'dev', now() - interval '90 minutes')
     on conflict (id) do update set voided = excluded.voided, void_reason = excluded.void_reason $$,
  'a removed Timekeeper''s capture made while they held the Role is accepted'
);
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at)
     values ('tc-after', 911, 1, 5, '05:04.00', 'dev', now() - interval '30 minutes')
     on conflict (id) do update set voided = excluded.voided, void_reason = excluded.void_reason $$,
  '42501', null, 'a removed Timekeeper''s capture made after their removal is refused'
);
select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at)
     values ('tc-before', 911, 1, 5, '05:04.00', 'dev', now() - interval '3 hours') $$,
  '42501', null, 'a removed Timekeeper''s capture made before they joined is refused'
);
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at)
     values ('pc-wrong-role', 911, 1, 2, 7, 'dev', now() - interval '90 minutes') $$,
  '42501', null, 'a removed Timekeeper''s position capture is refused, since they never held Placer'
);
select lives_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at)
     values ('on-late', 911, 1, 0, 'timer', 'note', 'dev', now() - interval '90 minutes')
     on conflict (id) do nothing $$,
  'a removed Timekeeper''s note written while they held the Role is accepted'
);
select throws_ok(
  $$ insert into operator_note (id, league_id, run_heat, anchor, screen, body, device_id, created_at)
     values ('on-after', 911, 1, 0, 'timer', 'note', 'dev', now() - interval '30 minutes') $$,
  '42501', null, 'a removed Timekeeper''s note written after their removal is refused'
);
select results_eq(
  $$ select id from time_capture $$, $$ values ('tc-late') $$,
  'a removed Timekeeper reads back their own captures, and no one else''s'
);
select lives_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at, voided, void_reason)
     values ('tc-late', 911, 1, 4, '05:03.00', 'dev', now() - interval '90 minutes', true, 'undo')
     on conflict (id) do update set voided = excluded.voided, void_reason = excluded.void_reason $$,
  'a removed Timekeeper''s void of their own capture, made while they held the Role, is accepted'
);
select is_empty(
  $$ update time_capture set voided = true, void_reason = 'undo' where id = 'tc-tk' returning 1 $$,
  'a removed Timekeeper can''t void someone else''s captures'
);

reset role;

select is(
  (select author_id from time_capture where id = 'tc-late'), '00000000-0000-0000-0000-0000000000e2'::uuid,
  'a late capture records the removed Timekeeper as its author'
);
select is(
  (select author_id from operator_note where id = 'on-late'), '00000000-0000-0000-0000-0000000000e2'::uuid,
  'a late note records the removed Timekeeper as its author'
);

---------------------------------------------------------------------------
-- The removed Placer, whose phone syncs late.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}';

select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at)
     values ('pc-late', 911, 1, 2, 7, 'dev', now() - interval '90 minutes')
     on conflict (id) do update set voided = excluded.voided, void_reason = excluded.void_reason $$,
  'a removed Placer''s capture made while they held the Role is accepted'
);
select lives_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at)
     values ('pc-late', 911, 1, 2, 7, 'dev', now() - interval '90 minutes')
     on conflict (id) do update set voided = excluded.voided, void_reason = excluded.void_reason $$,
  'a removed Placer''s capture resent after its reply was lost is accepted again'
);
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at)
     values ('pc-after', 911, 1, 3, 7, 'dev', now() - interval '30 minutes') $$,
  '42501', null, 'a removed Placer''s capture made after their removal is refused'
);

reset role;

select is(
  (select author_id from position_capture where id = 'pc-late'), '00000000-0000-0000-0000-0000000000d2'::uuid,
  'a late position capture records the removed Placer as its author'
);

---------------------------------------------------------------------------
-- A Member who was never on the team.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';

select throws_ok(
  $$ insert into time_capture (id, league_id, run_heat, seq, elapsed_time, device_id, captured_at)
     values ('tc-by', 911, 1, 6, '05:05.00', 'dev', now() - interval '90 minutes') $$,
  '42501', null, 'a Member never on the team can''t add a time capture'
);
select throws_ok(
  $$ insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at)
     values ('pc-by', 911, 1, 4, 7, 'dev', now() - interval '90 minutes') $$,
  '42501', null, 'a Member never on the team can''t add a position capture'
);

reset role;

select * from finish();
rollback;
