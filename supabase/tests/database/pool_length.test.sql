-- Pool length (#70): a League swims in a 25 m pool unless an Official on it
-- says otherwise, and each change goes to the League's audit log.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into organization (id, name) overriding system value values
  (981, 'Pool Length Org');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (981, 'League 5', '2026-10-25', 2026, 981),
  (982, 'League 6', '2026-11-01', 2026, 981);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000098101', 'official@pool.test'),
  ('00000000-0000-0000-0000-000000098102', 'timekeeper@pool.test');
insert into organization_member (organization_id, user_id, is_admin) values
  (981, '00000000-0000-0000-0000-000000098101', false),
  (981, '00000000-0000-0000-0000-000000098102', false);
insert into league_team_member (league_id, user_id, role) values
  (981, '00000000-0000-0000-0000-000000098101', 'official'),
  (981, '00000000-0000-0000-0000-000000098102', 'timekeeper');

select is(
  (select pool_length_m from league where id = 981),
  25,
  'a new League swims in a 25 m pool'
);

set local role authenticated;

-- The Official.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000098101", "role": "authenticated", "email": "official@pool.test"}';

select lives_ok(
  $$ select public.set_pool_length(981, 50) $$,
  'an Official changes their League''s Pool length'
);
select is(
  (select pool_length_m from league where id = 981),
  50,
  'the League now swims in a 50 m pool'
);
select results_eq(
  $$ select actor, entity, action, before, after from audit_log where league_id = 981 and entity = 'league' $$,
  $$ values ('official@pool.test', 'league', 'league.pool-length-changed',
       '{"pool_length_m": 25}'::jsonb, '{"pool_length_m": 50}'::jsonb) $$,
  'the change goes to the League''s audit log'
);
select throws_ok(
  $$ select public.set_pool_length(981, 33) $$,
  '23514', null,
  'a pool is 25 m or 50 m'
);
select throws_ok(
  $$ select public.set_pool_length(982, 50) $$,
  '42501', null,
  'an Official cannot change a League they are not on'
);

-- The Timekeeper.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000098102", "role": "authenticated", "email": "timekeeper@pool.test"}';

select throws_ok(
  $$ select public.set_pool_length(981, 25) $$,
  '42501', null,
  'a Timekeeper cannot change the Pool length'
);

-- Signed out.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select public.set_pool_length(981, 25) $$,
  '42501', null,
  'no one signed out can change the Pool length'
);

select * from finish();
rollback;
