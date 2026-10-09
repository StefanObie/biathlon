-- Swim folders (#71): an Admin sets their Organization's Swim folder, no two
-- Organizations share one, and an Official of a League remembers its League
-- folder.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into organization (id, name) overriding system value values
  (971, 'Swim Folder Org'),
  (972, 'Other Org');

insert into league (id, name, league_date, season, organization_id) overriding system value values
  (971, 'League 3', '2026-10-06', 2026, 971),
  (972, 'League 4', '2026-10-20', 2026, 971);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'admin@swim.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'official@swim.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'other-admin@swim.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'member@swim.test');
insert into organization_member (organization_id, user_id, is_admin) values
  (971, '00000000-0000-0000-0000-0000000000f1', true),
  (971, '00000000-0000-0000-0000-0000000000f2', false),
  (972, '00000000-0000-0000-0000-0000000000f3', true),
  (971, '00000000-0000-0000-0000-0000000000f4', false);
insert into league_team_member (league_id, user_id, role) values
  (971, '00000000-0000-0000-0000-0000000000f2', 'official');

set local role authenticated;

-- The Official.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated"}';

select throws_ok(
  $$ insert into swim_folder (organization_id, drive_folder_id) values (971, 'folderA') $$,
  '42501', null,
  'an Official cannot set the Swim folder'
);
select lives_ok(
  $$ insert into league_folder (league_id, drive_folder_id) values (971, 'leagueFolder3') $$,
  'an Official remembers their League''s League folder'
);
select throws_ok(
  $$ insert into league_folder (league_id, drive_folder_id) values (972, 'leagueFolder4') $$,
  '42501', null,
  'an Official cannot set the League folder of a League they are not on'
);

-- The Admin.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select lives_ok(
  $$ insert into swim_folder (organization_id, drive_folder_id) values (971, 'folderA') $$,
  'an Admin sets their Organization''s Swim folder'
);
select throws_ok(
  $$ insert into swim_folder (organization_id, drive_folder_id) values (971, 'not a folder id') $$,
  '23514', null,
  'a Swim folder id must look like a Drive id'
);

-- The Official reads it back.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated"}';

select results_eq(
  $$ select drive_folder_id from swim_folder where organization_id = 971 $$,
  $$ values ('folderA') $$,
  'an Official reads their Organization''s Swim folder'
);

-- A Member with no Role.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated"}';

select is_empty(
  $$ select 1 from swim_folder where organization_id = 971 $$,
  'a Member with no Role cannot read the Swim folder'
);

-- The other Organization's Admin.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated"}';

select is_empty(
  $$ select 1 from swim_folder where organization_id = 971 $$,
  'another Organization''s Admin cannot read the Swim folder'
);
select throws_ok(
  $$ insert into swim_folder (organization_id, drive_folder_id) values (972, 'folderA') $$,
  '23505', null,
  'another Organization cannot register the same Swim folder'
);
select is_empty(
  $$ select 1 from league_folder where league_id = 971 $$,
  'another Organization''s Admin cannot read the League folder'
);

select * from finish();
rollback;
