-- The Medals screen (#76). The public results' published times and points
-- table move into private helpers so league_medals reads exactly the same
-- data, and Officials can mark a group's medals as presented.

-- Every athlete entered in a League with their published times: a run time
-- once its heat is Closed (ADR 0001), a swim time whenever it is recorded and
-- ok. Shared by the public results and the Medals screen, so the two can't
-- disagree. Athletes with no time at all are included; callers decide.
create function private.published_times(target_league_id integer)
returns table (
  athlete_no integer,
  full_name text,
  gender public.gender,
  age_group_code text,
  run_time text,
  swim_time text
)
language sql
stable
set search_path = ''
as $$
  select e.athlete_no, a.full_name, a.gender, e.age_group_code,
    run.run_time, swim.swim_time
  from public.entry e
  join public.athlete a
    on a.organization_id = e.organization_id and a.athlete_no = e.athlete_no
  left join lateral (
    select rr.run_time
    from public.run_result rr
    join public.league_race r
      on r.league_id = rr.league_id and r.run_heat = rr.run_heat
    where rr.league_id = e.league_id
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
    where sr.league_id = e.league_id
      and sr.athlete_no = e.athlete_no
      and sr.status = 'ok'
      and sr.swim_time is not null
  ) swim on true
  where e.league_id = target_league_id;
$$;

-- The points table that applies on a League's date, as the results need it.
create function private.league_points_table(target_league_id integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'gender', p.gender,
        'age_group_code', p.age_group_code,
        'age_group_label', p.age_group_label,
        'sort_order', p.sort_order,
        'run_base_time', p.run_base_time,
        'run_points_per_second', p.run_points_per_second,
        'swim_distance_m', p.swim_distance_m,
        'swim_base_time', p.swim_base_time,
        'swim_points_per_second', p.swim_points_per_second,
        'short_course_seconds_per_turn', p.short_course_seconds_per_turn
      )
      order by p.gender, p.sort_order
    )
    from public.points_table p
    join public.league l on l.id = target_league_id
    where p.effective_from = (
      select max(p2.effective_from) from public.points_table p2
      where p2.effective_from <= l.league_date
    )
  ), '[]'::jsonb);
$$;

revoke execute on function private.published_times(integer) from public, anon, authenticated;
revoke execute on function private.league_points_table(integer) from public, anon, authenticated;

-- Published results for anyone: the heat counts and, per athlete, the times
-- that are published, with the points table that applies on the League's
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
    'pool_length_m', l.pool_length_m,
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
          'full_name', t.full_name,
          'gender', t.gender,
          'age_group_code', t.age_group_code,
          'run_time', t.run_time,
          'swim_time', t.swim_time
        )
        order by t.full_name, t.athlete_no
      )
      from private.published_times(l.id) t
      where t.run_time is not null or t.swim_time is not null
    ), '[]'::jsonb),
    'points_table', private.league_points_table(l.id)
  )
  from public.league l
  join public.organization o on o.id = l.organization_id
  where l.results_slug = slug and l.visibility <> 'private';
$$;

-- Medals presented (#76): an Official's mark that a gender and age group's
-- medals have been handed out, with the podium as it was then, so the Medals
-- screen can say when it has changed since. Never shown on the public results.
-- Unclassified athletes get no medals, so a group always has an age group.
create table medal_presentation (
  league_id integer not null references league (id),
  gender gender not null,
  age_group_code text not null,
  -- [{ "athlete_no": 12, "medal_place": 1 }, ...]
  podium jsonb not null check (jsonb_typeof(podium) = 'array'),
  presented_at timestamptz not null default now(),
  presented_by uuid,
  primary key (league_id, gender, age_group_code)
);

alter table medal_presentation enable row level security;

-- The time and the Member are the database's, whatever the client sent, and
-- marking a group again restamps both.
create function private.stamp_medal_presentation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.presented_at := now();
  new.presented_by := (select auth.uid());
  return new;
end;
$$;

create trigger medal_presentation_stamp
  before insert or update on medal_presentation
  for each row execute function private.stamp_medal_presentation();

create policy "Officials can read their leagues' medal presentations"
  on medal_presentation for select
  to authenticated
  using (private.has_league_role(league_id, 'official'));

create policy "Officials can mark medals presented"
  on medal_presentation for insert
  to authenticated
  with check (private.has_league_role(league_id, 'official'));

create policy "Officials can mark medals presented again"
  on medal_presentation for update
  to authenticated
  using (private.has_league_role(league_id, 'official'))
  with check (private.has_league_role(league_id, 'official'));

create policy "Officials can clear medals presented"
  on medal_presentation for delete
  to authenticated
  using (private.has_league_role(league_id, 'official'));

-- What the Medals screen ranks (#76): the same published times and points
-- table as league_results, for any League an Official is on, whatever its
-- Visibility. Athlete numbers are returned, and athletes with no time are
-- too, so the screen can count who is still missing one.
create function public.league_medals(target_league_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_league_role(target_league_id, 'official') then
    raise exception 'Only an Official of the League can see its medals'
      using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'pool_length_m', l.pool_length_m,
      'athletes', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'athlete_no', t.athlete_no,
            'full_name', t.full_name,
            'gender', t.gender,
            'age_group_code', t.age_group_code,
            'run_time', t.run_time,
            'swim_time', t.swim_time
          )
          order by t.full_name, t.athlete_no
        )
        from private.published_times(l.id) t
      ), '[]'::jsonb),
      'points_table', private.league_points_table(l.id)
    )
    from public.league l
    where l.id = target_league_id
  );
end;
$$;

revoke execute on function public.league_medals(integer) from public, anon;
grant execute on function public.league_medals(integer) to authenticated;
