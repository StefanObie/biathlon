-- The public results page (#48): every athlete's published run and swim
-- times, and the points table that scores them.

-- The 2027 season's times for 1,000 points (Age Group & Points Table 2027 PDF,
-- effective 1 May 2026). Bonus points for age are stored but not used: they
-- need a birth year, which we don't have. Swimming is 5 points a second, except
-- that U/13 swimming 50 m is 10. Masters 80+ is here though the start list
-- import has no label for it yet.
insert into public.points_table (
  effective_from, gender, age_group_code, age_group_label, sort_order, age_from, age_to,
  run_distance_m, run_base_time, run_points_per_second,
  swim_distance_m, swim_base_time, swim_points_per_second, bonus_points_per_year
) values
  ('2026-05-01', 'F', 'U08', 'Under 8',     1,  0,   7, 400, '02:00.00', 2,  25, '00:35.00',  5,  0),
  ('2026-05-01', 'F', 'U09', 'Under 9',     2,  8,   8, 400, '01:47.00', 2,  50, '00:56.00',  5,  0),
  ('2026-05-01', 'F', 'U11', 'Under 11',    3,  9,  10, 400, '01:38.00', 2,  50, '00:46.00',  5,  0),
  ('2026-05-01', 'F', 'U13', 'Under 13',    4, 11,  12, 800, '03:01.00', 2,  50, '00:38.00', 10,  0),
  ('2026-05-01', 'F', 'U15', 'Under 15',    5, 13,  14, 800, '02:53.00', 2, 100, '01:15.00',  5,  0),
  ('2026-05-01', 'F', 'U17', 'Under 17',    6, 15,  16, 800, '02:43.00', 2, 100, '01:15.00',  5,  0),
  ('2026-05-01', 'F', 'U19', 'Under 19',    7, 17,  18, 800, '02:54.00', 2, 100, '01:14.00',  5,  0),
  ('2026-05-01', 'F', 'JNR', 'Juniors 19-27', 8, 19, 27, 800, '02:58.00', 2, 100, '01:19.00',  5,  0),
  ('2026-05-01', 'F', 'SEN', 'Seniors 28-39', 9, 28, 39, 800, '03:06.00', 2, 100, '01:25.00',  5,  3),
  ('2026-05-01', 'F', 'M40', 'Masters 40-49', 10, 40, 49, 800, '03:11.00', 2, 100, '01:24.00',  5,  5),
  ('2026-05-01', 'F', 'M50', 'Masters 50-59', 11, 50, 59, 800, '03:10.00', 2, 100, '01:34.00',  5,  5),
  ('2026-05-01', 'F', 'M60', 'Masters 60-69', 12, 60, 69, 400, '01:46.00', 2,  50, '00:51.00',  5,  6),
  ('2026-05-01', 'F', 'M70', 'Masters 70+', 13, 70, 79, 400, '01:58.00', 2,  50, '00:58.00',  5, 10),
  ('2026-05-01', 'F', 'M80', 'Masters 80+', 14, 80, 120, 400, '02:37.00', 2, 50, '01:10.00',  5, 12),
  ('2026-05-01', 'F', 'SN',  'Special needs', 15, 0, 120, 400, '02:00.00', 2, 50, '00:45.00',  5,  0),
  ('2026-05-01', 'M', 'U08', 'Under 8',     1,  0,   7, 400, '01:58.00', 2,  25, '00:33.00',  5,  0),
  ('2026-05-01', 'M', 'U09', 'Under 9',     2,  8,   8, 400, '01:43.00', 2,  50, '00:51.00',  5,  0),
  ('2026-05-01', 'M', 'U11', 'Under 11',    3,  9,  10, 400, '01:37.00', 2,  50, '00:44.00',  5,  0),
  ('2026-05-01', 'M', 'U13', 'Under 13',    4, 11,  12, 800, '03:00.00', 2,  50, '00:36.00', 10,  0),
  ('2026-05-01', 'M', 'U15', 'Under 15',    5, 13,  14, 800, '02:47.00', 2, 100, '01:13.00',  5,  0),
  ('2026-05-01', 'M', 'U17', 'Under 17',    6, 15,  16, 800, '02:36.00', 2, 100, '01:10.00',  5,  0),
  ('2026-05-01', 'M', 'U19', 'Under 19',    7, 17,  18, 800, '02:29.00', 2, 100, '01:08.00',  5,  0),
  ('2026-05-01', 'M', 'JNR', 'Juniors 19-27', 8, 19, 27, 800, '02:35.00', 2, 100, '01:09.00',  5,  0),
  ('2026-05-01', 'M', 'SEN', 'Seniors 28-39', 9, 28, 39, 800, '02:40.00', 2, 100, '01:15.00',  5,  3),
  ('2026-05-01', 'M', 'M40', 'Masters 40-49', 10, 40, 49, 800, '02:40.00', 2, 100, '01:15.00',  5,  5),
  ('2026-05-01', 'M', 'M50', 'Masters 50-59', 11, 50, 59, 800, '02:46.00', 2, 100, '01:18.00',  5,  5),
  ('2026-05-01', 'M', 'M60', 'Masters 60-69', 12, 60, 69, 400, '01:30.00', 2,  50, '00:43.00',  5,  6),
  ('2026-05-01', 'M', 'M70', 'Masters 70+', 13, 70, 79, 400, '01:40.00', 2,  50, '00:50.00',  5, 10),
  ('2026-05-01', 'M', 'M80', 'Masters 80+', 14, 80, 120, 400, '02:17.00', 2, 50, '00:53.00',  5, 12),
  ('2026-05-01', 'M', 'SN',  'Special needs', 15, 0, 120, 400, '02:00.00', 2, 50, '00:45.00',  5,  0);

-- Published results for anyone: the heat counts and, per athlete, the times
-- that are published (a run time once its heat is Closed, ADR 0001; a swim time
-- whenever it exists), with the points table that applies on the League's
-- date. Athlete numbers are not returned, and an athlete with no time at all
-- is left out: they did not show up.
create or replace function public.league_results(slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', l.name,
    'organization_name', o.name,
    'league_date', l.league_date,
    'season', l.season,
    'visibility', l.visibility,
    'heats_total', (
      select count(distinct e.run_heat) from public.entry e where e.league_id = l.id
    ),
    'heats_closed', (
      select count(distinct r.run_heat) from public.league_race r
      where r.league_id = l.id and r.closed_at is not null
        and exists (
          select 1 from public.entry e
          where e.league_id = l.id and e.run_heat = r.run_heat
        )
    ),
    'athletes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'full_name', a.full_name,
          'gender', a.gender,
          'age_group_code', e.age_group_code,
          'run_time', run.run_time,
          'swim_time', swim.swim_time
        )
        order by a.full_name, e.athlete_no
      )
      from public.entry e
      join public.athlete a
        on a.organization_id = e.organization_id and a.athlete_no = e.athlete_no
      left join lateral (
        select rr.run_time
        from public.run_result rr
        join public.league_race r
          on r.league_id = rr.league_id and r.run_heat = rr.run_heat
        where rr.league_id = l.id
          and rr.athlete_no = e.athlete_no
          and rr.status = 'ok'
          and rr.run_time is not null
          and r.closed_at is not null
        order by rr.run_heat
        limit 1
      ) run on true
      left join lateral (
        select sr.swim_time
        from public.swim_result sr
        where sr.league_id = l.id
          and sr.athlete_no = e.athlete_no
          and sr.status = 'ok'
          and sr.swim_time is not null
      ) swim on true
      where e.league_id = l.id
        and (run.run_time is not null or swim.swim_time is not null)
    ), '[]'::jsonb),
    'points_table', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'gender', p.gender,
          'age_group_code', p.age_group_code,
          'age_group_label', p.age_group_label,
          'sort_order', p.sort_order,
          'run_base_time', p.run_base_time,
          'run_points_per_second', p.run_points_per_second,
          'swim_base_time', p.swim_base_time,
          'swim_points_per_second', p.swim_points_per_second
        )
        order by p.gender, p.sort_order
      )
      from public.points_table p
      where p.effective_from = (
        select max(p2.effective_from) from public.points_table p2
        where p2.effective_from <= l.league_date
      )
    ), '[]'::jsonb)
  )
  from public.league l
  join public.organization o on o.id = l.organization_id
  where l.results_slug = slug and l.visibility <> 'private';
$$;
