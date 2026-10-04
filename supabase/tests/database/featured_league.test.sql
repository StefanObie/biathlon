-- The Featured league on the home page (#58).

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- Hide the local seed data so it can't be featured.
update league set visibility = 'private', results_slug = null;

insert into organization (id, name) overriding system value values
  (961, 'Featured Org A'),
  (962, 'Featured Org B');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$ select * from public.featured_league() $$,
  'anon can call it, and it returns nothing when there are no Leagues'
);

reset role;

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (961, 'Future', current_date + 30, 2027, 961, 'public', 'featured-future'),
  (962, 'Protected', current_date - 1, 2027, 961, 'protected', 'Abcdefghijklmnopqrstuv_-XYZ'),
  (963, 'Private', current_date - 1, 2027, 961, 'private', null);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$ select * from public.featured_league() $$,
  'nothing when only future, Protected and Private Leagues exist'
);

reset role;

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (964, 'Older', current_date - 20, 2027, 961, 'public', 'featured-older'),
  (965, 'Latest', current_date - 10, 2027, 962, 'public', 'featured-latest');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$ select name, organization_name, league_date, results_slug from public.featured_league() $$,
  $$ select 'Latest'::text, 'Featured Org B'::text, current_date - 10, 'featured-latest'::text $$,
  'the Public League with the latest date wins, with its Organization and slug'
);

reset role;

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (966, 'Today', current_date, 2027, 961, 'public', 'featured-today');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select results_slug from public.featured_league()),
  'featured-today',
  'a League dated today qualifies'
);
select is(
  (select count(*) from public.featured_league()),
  1::bigint,
  'at most one League is featured'
);

reset role;

insert into league (id, name, league_date, season, organization_id, visibility, results_slug)
overriding system value values
  (967, 'Same day newer', current_date, 2027, 962, 'public', 'featured-same-day');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select results_slug from public.featured_league()),
  'featured-same-day',
  'a tie on date goes to the newest League'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000aa"}';

select is(
  (select results_slug from public.featured_league()),
  'featured-same-day',
  'a signed-in user sees the same Featured league'
);

reset role;
update league set visibility = 'private', results_slug = null where id in (966, 967);
update league set league_date = current_date + 1 where id in (964, 965);
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$ select * from public.featured_league() $$,
  'nothing once no Public League is on or before today'
);

select * from finish();
rollback;
