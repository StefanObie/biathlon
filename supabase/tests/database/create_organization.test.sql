-- Signing up creates an Organization (#30).
--
-- Any signed-in user can create an Organization and becomes its only
-- Admin. Nobody can make themselves a Member or Admin of an Organization
-- that already exists.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Fixtures, written as the table owner so RLS doesn't apply.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin-a@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'newcomer@example.com');

insert into organization (id, name) overriding system value values
  (901, 'Organization A');

insert into organization_member (organization_id, user_id, is_admin) values
  (901, '00000000-0000-0000-0000-00000000000a', true);

---------------------------------------------------------------------------
-- A user with no membership creates an Organization and becomes its Admin.
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select throws_ok(
  $$ select public.create_organization('  ') $$,
  '22023', 'An organization needs a name',
  'an Organization needs a name'
);

create temporary table created on commit drop as
  select public.create_organization('  Organization C  ') as id;

select results_eq(
  $$ select name from organization where id = (select id from created) $$,
  $$ values ('Organization C') $$,
  'the creator can read the new Organization, its name trimmed'
);
select results_eq(
  $$ select user_id, is_admin from organization_member where organization_id = (select id from created) $$,
  $$ values ('00000000-0000-0000-0000-00000000000c'::uuid, true) $$,
  'the creator is the new Organization''s only Member, and its Admin'
);
select lives_ok(
  $$ insert into league (name, league_date, season, organization_id) select 'First League', '2026-01-01', 2026, id from created $$,
  'as its Admin, the creator can create a League in it'
);

---------------------------------------------------------------------------
-- They can't make themselves a Member or Admin of an existing Organization.
---------------------------------------------------------------------------

select throws_ok(
  $$ insert into organization_member (organization_id, user_id, is_admin) values (901, '00000000-0000-0000-0000-00000000000c', false) $$,
  '42501', null, 'a user can''t make themselves a Member of an existing Organization'
);
select throws_ok(
  $$ insert into organization_member (organization_id, user_id, is_admin) values (901, '00000000-0000-0000-0000-00000000000c', true) $$,
  '42501', null, 'a user can''t make themselves an Admin of an existing Organization'
);
select throws_ok(
  $$ insert into organization (name) values ('Direct Insert') $$,
  '42501', null, 'Organizations are only created through create_organization'
);

-- Promoting their own membership elsewhere matches nothing.
update organization_member set is_admin = true, organization_id = 901
  where user_id = '00000000-0000-0000-0000-00000000000c';

---------------------------------------------------------------------------
-- An existing Admin can still create another Organization.
---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_organization('Organization D') $$,
  'a Member of an Organization can create another one'
);
select results_eq(
  $$ select o.name, m.is_admin from organization o join organization_member m on m.organization_id = o.id order by o.name $$,
  $$ values ('Organization A', true), ('Organization D', true) $$,
  'they are Admin of both'
);

---------------------------------------------------------------------------
-- Anonymous users can't create Organizations.
---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select public.create_organization('Organization E') $$,
  '42501', null, 'anonymous users can''t create an Organization'
);

reset role;

select results_eq(
  $$ select organization_id, is_admin from organization_member where user_id = '00000000-0000-0000-0000-00000000000c' $$,
  $$ select id, true from organization where name = 'Organization C' $$,
  'the newcomer is still only a Member of their own Organization'
);
select is(
  (select count(*)::integer from organization_member where organization_id = 901),
  1,
  'Organization A still has only its original Admin'
);

select * from finish();
rollback;
