-- Local development seed: league 1 with a start list and raw captures.
--
-- Loaded by `supabase db reset` (config.toml [db.seed]). Only the start list
-- and what the capture screens record are seeded — no run_result or
-- audit_log rows, so every heat is still waiting to be reconciled.
--
--   Heat 1: a clean run. 10 on the roster, 10 times, 10 positions.
--   Heat 2: a messy run for reconciliation to work through —
--           time seq 4 is a Missed finish, seq 7 was undone (voided) and
--           re-pressed as seq 8, position 6 is a Skip, and position 11 is
--           athlete 121 from heat 3, so the Position screen reads 11 / 10.
--   Heat 3: start list only, not started, for trying the capture screens.
--
-- League 1 belongs to Gauteng North Biathlon, which the organizations
-- migration creates. Sign in locally with one of these emails (the code
-- arrives in Mailpit) to see League 1 as that Role:
--
--   admin@example.com       Admin of the Organization
--   timekeeper@example.com  Timekeeper on League 1's team
--   placer@example.com      Placer on League 1's team
--
-- Any other email signs in to an account with no Organization and sees no
-- leagues.

insert into athlete (organization_id, athlete_no, full_name, gender)
select (select id from organization where name = 'Gauteng North Biathlon'), athlete_no, full_name, gender::gender from (values
  (101, 'Liam Botha', 'M'),
  (102, 'Emma van Wyk', 'F'),
  (103, 'Noah Naidoo', 'M'),
  (104, 'Mia Dlamini', 'F'),
  (105, 'Ethan Pretorius', 'M'),
  (106, 'Olivia Mokoena', 'F'),
  (107, 'Lucas Smit', 'M'),
  (108, 'Ava Jacobs', 'F'),
  (109, 'Daniel Khumalo', 'M'),
  (110, 'Zoe Fourie', 'F'),
  (111, 'Jacob Venter', 'M'),
  (112, 'Chloe Nel', 'F'),
  (113, 'Ruben Maharaj', 'M'),
  (114, 'Lily Coetzee', 'F'),
  (115, 'Adam Mahlangu', 'M'),
  (116, 'Grace du Toit', 'F'),
  (117, 'Luke Petersen', 'M'),
  (118, 'Hannah Kruger', 'F'),
  (119, 'Sipho Ndlovu', 'M'),
  (120, 'Megan Swart', 'F'),
  (121, 'Pieter Meyer', 'M'),
  (122, 'Nadia Joubert', 'F'),
  (123, 'Thabo Zulu', 'M'),
  (124, 'Karen Visser', 'F'),
  (125, 'Johan Steyn', 'M'),
  (126, 'Anne le Roux', 'F'),
  (127, 'Willem Brink', 'M'),
  (128, 'Sarah Adams', 'F')
) as v (athlete_no, full_name, gender);

-- The token columns are empty strings, not null: GoTrue fails to load a user
-- whose token columns are null.
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1',
    'authenticated', 'authenticated', 'admin@example.com', now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2',
    'authenticated', 'authenticated', 'timekeeper@example.com', now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3',
    'authenticated', 'authenticated', 'placer@example.com', now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
    '{"sub": "00000000-0000-0000-0000-0000000000a1", "email": "admin@example.com", "email_verified": true}',
    'email', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2',
    '{"sub": "00000000-0000-0000-0000-0000000000a2", "email": "timekeeper@example.com", "email_verified": true}',
    'email', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3',
    '{"sub": "00000000-0000-0000-0000-0000000000a3", "email": "placer@example.com", "email_verified": true}',
    'email', now(), now(), now()
  );

insert into organization_member (organization_id, user_id, is_admin)
select id, user_id::uuid, is_admin
from organization, (values
  ('00000000-0000-0000-0000-0000000000a1', true),
  ('00000000-0000-0000-0000-0000000000a2', false),
  ('00000000-0000-0000-0000-0000000000a3', false)
) as v (user_id, is_admin)
where name = 'Gauteng North Biathlon';

insert into league (id, name, league_date, season, organization_id) overriding system value
select 1, 'League 1', '2026-08-25', 2026, id
from organization where name = 'Gauteng North Biathlon';

select setval(pg_get_serial_sequence('league', 'id'), (select max(id) from league));

insert into league_team_member (league_id, user_id, role) values
  (1, '00000000-0000-0000-0000-0000000000a2', 'timekeeper'),
  (1, '00000000-0000-0000-0000-0000000000a3', 'placer');

insert into entry (league_id, athlete_no, run_heat, swim_heat, swim_lane, age_group_code) values
  (1, 101, 1, 1, 1, 'U13'),
  (1, 102, 1, 1, 2, 'U13'),
  (1, 103, 1, 1, 3, 'U13'),
  (1, 104, 1, 1, 4, 'U13'),
  (1, 105, 1, 1, 5, 'U15'),
  (1, 106, 1, 1, 6, 'U15'),
  (1, 107, 1, 1, 7, 'U15'),
  (1, 108, 1, 1, 8, 'U15'),
  (1, 109, 1, 2, 1, 'U15'),
  (1, 110, 1, 2, 2, 'U15'),
  (1, 111, 2, 2, 3, 'U17'),
  (1, 112, 2, 2, 4, 'U17'),
  (1, 113, 2, 2, 5, 'U17'),
  (1, 114, 2, 2, 6, 'U17'),
  (1, 115, 2, 2, 7, 'U19'),
  (1, 116, 2, 2, 8, 'U19'),
  (1, 117, 2, 3, 1, 'U19'),
  (1, 118, 2, 3, 2, 'U19'),
  (1, 119, 2, 3, 3, 'JNR'),
  (1, 120, 2, 3, 4, 'JNR'),
  (1, 121, 3, 3, 5, 'SEN'),
  (1, 122, 3, 3, 6, 'SEN'),
  (1, 123, 3, 3, 7, 'M40'),
  (1, 124, 3, 3, 8, 'M40'),
  (1, 125, 3, 4, 1, 'M50'),
  (1, 126, 3, 4, 2, 'M50'),
  (1, 127, 3, 4, 3, 'M60'),
  (1, 128, 3, 4, 4, 'SN');

insert into league_race (league_id, run_heat, started_at, device_id) values
  (1, 1, '2026-08-25T09:00:00+02:00', 'seed-timer'),
  (1, 2, '2026-08-25T09:20:00+02:00', 'seed-timer');

insert into time_capture (id, league_id, run_heat, seq, elapsed_time, is_placeholder, device_id, captured_at, voided, void_reason) values
  ('01K5SEEDTH1N01000000000000', 1, 1, 1, '06:41.20', false, 'seed-timer', '2026-08-25T09:06:41.200000+02:00', false, null),
  ('01K5SEEDTH1N02000000000000', 1, 1, 2, '06:48.93', false, 'seed-timer', '2026-08-25T09:06:48.930000+02:00', false, null),
  ('01K5SEEDTH1N03000000000000', 1, 1, 3, '06:55.07', false, 'seed-timer', '2026-08-25T09:06:55.070000+02:00', false, null),
  ('01K5SEEDTH1N04000000000000', 1, 1, 4, '07:02.66', false, 'seed-timer', '2026-08-25T09:07:02.660000+02:00', false, null),
  ('01K5SEEDTH1N05000000000000', 1, 1, 5, '07:10.41', false, 'seed-timer', '2026-08-25T09:07:10.410000+02:00', false, null),
  ('01K5SEEDTH1N06000000000000', 1, 1, 6, '07:18.02', false, 'seed-timer', '2026-08-25T09:07:18.020000+02:00', false, null),
  ('01K5SEEDTH1N07000000000000', 1, 1, 7, '07:24.85', false, 'seed-timer', '2026-08-25T09:07:24.850000+02:00', false, null),
  ('01K5SEEDTH1N08000000000000', 1, 1, 8, '07:33.19', false, 'seed-timer', '2026-08-25T09:07:33.190000+02:00', false, null),
  ('01K5SEEDTH1N09000000000000', 1, 1, 9, '07:47.50', false, 'seed-timer', '2026-08-25T09:07:47.500000+02:00', false, null),
  ('01K5SEEDTH1N10000000000000', 1, 1, 10, '08:05.34', false, 'seed-timer', '2026-08-25T09:08:05.340000+02:00', false, null),
  ('01K5SEEDTH2N01000000000000', 1, 2, 1, '05:58.12', false, 'seed-timer', '2026-08-25T09:25:58.120000+02:00', false, null),
  ('01K5SEEDTH2N02000000000000', 1, 2, 2, '06:03.47', false, 'seed-timer', '2026-08-25T09:26:03.470000+02:00', false, null),
  ('01K5SEEDTH2N03000000000000', 1, 2, 3, '06:11.90', false, 'seed-timer', '2026-08-25T09:26:11.900000+02:00', false, null),
  ('01K5SEEDTH2N04000000000000', 1, 2, 4, '06:19.33', true, 'seed-timer', '2026-08-25T09:26:19.330000+02:00', false, null),
  ('01K5SEEDTH2N05000000000000', 1, 2, 5, '06:26.08', false, 'seed-timer', '2026-08-25T09:26:26.080000+02:00', false, null),
  ('01K5SEEDTH2N06000000000000', 1, 2, 6, '06:34.71', false, 'seed-timer', '2026-08-25T09:26:34.710000+02:00', false, null),
  ('01K5SEEDTH2N07000000000000', 1, 2, 7, '06:35.02', false, 'seed-timer', '2026-08-25T09:26:35.020000+02:00', true, 'Double press'),
  ('01K5SEEDTH2N08000000000000', 1, 2, 8, '06:42.55', false, 'seed-timer', '2026-08-25T09:26:42.550000+02:00', false, null),
  ('01K5SEEDTH2N09000000000000', 1, 2, 9, '06:50.16', false, 'seed-timer', '2026-08-25T09:26:50.160000+02:00', false, null),
  ('01K5SEEDTH2N10000000000000', 1, 2, 10, '07:01.88', false, 'seed-timer', '2026-08-25T09:27:01.880000+02:00', false, null),
  ('01K5SEEDTH2N11000000000000', 1, 2, 11, '07:15.40', false, 'seed-timer', '2026-08-25T09:27:15.400000+02:00', false, null);

insert into position_capture (id, league_id, run_heat, position, athlete_no, device_id, scanned_at) values
  ('01K5SEEDPH1N01000000000000', 1, 1, 1, 105, 'seed-position', '2026-08-25T09:06:56.200000+02:00'),
  ('01K5SEEDPH1N02000000000000', 1, 1, 2, 101, 'seed-position', '2026-08-25T09:07:03.930000+02:00'),
  ('01K5SEEDPH1N03000000000000', 1, 1, 3, 109, 'seed-position', '2026-08-25T09:07:10.070000+02:00'),
  ('01K5SEEDPH1N04000000000000', 1, 1, 4, 102, 'seed-position', '2026-08-25T09:07:17.660000+02:00'),
  ('01K5SEEDPH1N05000000000000', 1, 1, 5, 107, 'seed-position', '2026-08-25T09:07:25.410000+02:00'),
  ('01K5SEEDPH1N06000000000000', 1, 1, 6, 106, 'seed-position', '2026-08-25T09:07:33.020000+02:00'),
  ('01K5SEEDPH1N07000000000000', 1, 1, 7, 103, 'seed-position', '2026-08-25T09:07:39.850000+02:00'),
  ('01K5SEEDPH1N08000000000000', 1, 1, 8, 110, 'seed-position', '2026-08-25T09:07:48.190000+02:00'),
  ('01K5SEEDPH1N09000000000000', 1, 1, 9, 104, 'seed-position', '2026-08-25T09:08:02.500000+02:00'),
  ('01K5SEEDPH1N10000000000000', 1, 1, 10, 108, 'seed-position', '2026-08-25T09:08:20.340000+02:00'),
  ('01K5SEEDPH2N01000000000000', 1, 2, 1, 115, 'seed-position', '2026-08-25T09:26:13.120000+02:00'),
  ('01K5SEEDPH2N02000000000000', 1, 2, 2, 119, 'seed-position', '2026-08-25T09:26:18.470000+02:00'),
  ('01K5SEEDPH2N03000000000000', 1, 2, 3, 111, 'seed-position', '2026-08-25T09:26:26.900000+02:00'),
  ('01K5SEEDPH2N04000000000000', 1, 2, 4, 117, 'seed-position', '2026-08-25T09:26:34.330000+02:00'),
  ('01K5SEEDPH2N05000000000000', 1, 2, 5, 113, 'seed-position', '2026-08-25T09:26:41.080000+02:00'),
  ('01K5SEEDPH2N06000000000000', 1, 2, 6, null, 'seed-position', '2026-08-25T09:26:49.710000+02:00'),
  ('01K5SEEDPH2N07000000000000', 1, 2, 7, 112, 'seed-position', '2026-08-25T09:26:57.550000+02:00'),
  ('01K5SEEDPH2N08000000000000', 1, 2, 8, 116, 'seed-position', '2026-08-25T09:27:05.160000+02:00'),
  ('01K5SEEDPH2N09000000000000', 1, 2, 9, 120, 'seed-position', '2026-08-25T09:27:16.880000+02:00'),
  ('01K5SEEDPH2N10000000000000', 1, 2, 10, 114, 'seed-position', '2026-08-25T09:27:30.400000+02:00'),
  ('01K5SEEDPH2N11000000000000', 1, 2, 11, 121, 'seed-position', '2026-08-25T09:27:30.400000+02:00');
