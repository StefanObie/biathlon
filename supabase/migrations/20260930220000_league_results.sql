SET local check_function_bodies = off;

-- Visibility and the Results slug (#28). Visibility says who can see a
-- League's published results without signing in; the Results slug is the
-- part of the results address that identifies the League. A Public League
-- has a readable slug an Admin can change, a Protected League a random one
-- (which is its Results link), and a Private League none.
create type league_visibility as enum ('public', 'protected', 'private');

alter table league
  add column visibility league_visibility not null default 'public',
  add column results_slug text;

-- Lowercase letters and digits with single hyphens between them, and no
-- hyphen at either end. Mirrors normaliseSlug in lib/results/slug.ts.
create function private.normalise_slug(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(input), '[^a-z0-9]+', '-', 'g'));
$$;

-- The default Public slug: the Organization name and League name,
-- hyphenated, with a counter (-2, -3, ...) until no League has it. Mirrors
-- defaultSlug in lib/results/slug.ts. The unique constraint is the real
-- guard; two Leagues created at the same moment can still race here, and
-- the loser's insert fails and is retried.
create function private.default_results_slug(org_id integer, league_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  select private.normalise_slug(o.name || ' ' || league_name) into base
  from public.organization o where o.id = org_id;
  base := trim(both '-' from left(coalesce(base, ''), 80));
  if char_length(base) < 3 then
    base := 'league';
  end if;
  loop
    candidate := case when n = 1 then base else
      trim(both '-' from left(base, 80 - char_length('-' || n))) || '-' || n end;
    exit when not exists (select 1 from public.league l where l.results_slug = candidate);
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

-- Every existing League was visible only to its Members, and Public is the
-- new default, so each gets its default slug.
do $$
declare
  l record;
begin
  for l in select id, organization_id, name from public.league order by id loop
    update public.league
    set results_slug = private.default_results_slug(l.organization_id, l.name)
    where id = l.id;
  end loop;
end;
$$;

-- A League created without a slug (a test fixture, a script) gets the
-- default Public one. The app sets its own, so it can retry on a collision.
create function private.set_default_results_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'public' and new.results_slug is null then
    new.results_slug := private.default_results_slug(new.organization_id, new.name);
  end if;
  return new;
end;
$$;

create trigger league_default_results_slug
  before insert on league
  for each row execute function private.set_default_results_slug();

alter table league
  add constraint league_results_slug_key unique (results_slug),
  add constraint league_results_slug_format check (
    coalesce(
      case visibility
        when 'private' then results_slug is null
        when 'public' then
          results_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          and char_length(results_slug) between 3 and 80
        -- Random: 22 or more URL-safe characters including an uppercase
        -- letter, so it can never be a valid custom slug.
        else results_slug ~ '^[A-Za-z0-9_-]{22,}$' and results_slug ~ '[A-Z]'
      end,
      false
    )
  );

-- A League's published results, for anyone, signed in or not: only its
-- Closed heats (ADR 0001), with the minimum athlete and entry fields to
-- list them. A Private League has no slug, so an unknown slug and a Private
-- League's former address are both just null. security definer so anon
-- needs no access to the tables; nothing operational is returned.
create function public.league_results(slug text)
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
    'heats', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'run_heat', r.run_heat,
          'closed_at', r.closed_at,
          'athletes', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'athlete_no', e.athlete_no,
                'full_name', a.full_name,
                'age_group_code', e.age_group_code
              )
              order by e.athlete_no
            )
            from public.entry e
            join public.athlete a
              on a.organization_id = e.organization_id and a.athlete_no = e.athlete_no
            where e.league_id = l.id and e.run_heat = r.run_heat
          ), '[]'::jsonb)
        )
        order by r.run_heat
      )
      from public.league_race r
      where r.league_id = l.id and r.closed_at is not null
    ), '[]'::jsonb)
  )
  from public.league l
  join public.organization o on o.id = l.organization_id
  where l.results_slug = slug and l.visibility <> 'private';
$$;

revoke execute on function public.league_results(text) from public;
grant execute on function public.league_results(text) to anon, authenticated;
