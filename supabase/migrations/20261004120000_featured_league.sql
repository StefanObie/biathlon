SET local check_function_bodies = off;

-- The Featured league for the home page: the Public League with the latest
-- date on or before today (South African time), across all Organizations,
-- the newest League winning a tie on date. No row when none qualifies.
-- Protected and Private Leagues are never returned. security definer so anon
-- needs no access to the tables.
create function public.featured_league()
returns table (name text, organization_name text, league_date date, results_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.name, o.name, l.league_date, l.results_slug
  from public.league l
  join public.organization o on o.id = l.organization_id
  where l.visibility = 'public'
    and l.league_date <= (now() at time zone 'Africa/Johannesburg')::date
  order by l.league_date desc, l.id desc
  limit 1;
$$;

revoke execute on function public.featured_league() from public;
grant execute on function public.featured_league() to anon, authenticated;
