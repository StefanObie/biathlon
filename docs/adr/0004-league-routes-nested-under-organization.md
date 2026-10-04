# League routes are nested under their Organization

Every League belongs to exactly one Organization, but League screens used to live at `/leagues/[leagueId]/…`, apart from the Organization pages at `/organizations/[organizationId]/…`. We moved them to `/organizations/[organizationId]/leagues/[leagueId]/…`, so the address shows where a League sits, and the header's Organization and League switchers read their context straight from the route. We use numeric ids rather than readable slugs for now. That needs no schema change, and an Organization slug can be added later.

## Consequences

- Old `/leagues/…` addresses were deliberately not redirected, because the app was not live yet. Anything that still builds one is a bug.
- An address names both ids, so a page has to check that the League really belongs to the named Organization and show not-found when it doesn't. RLS remains the access boundary.
- Every link, redirect and revalidated path that names a League also needs its Organization id.
