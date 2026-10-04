/**
 * Splits Leagues into Upcoming (dated `today` or later, soonest first) and
 * Past (most recent first). Dates are ISO `YYYY-MM-DD`, so they compare as
 * strings.
 */
export function splitLeagues<T extends { league_date: string }>(
  leagues: T[],
  today: string,
): { upcoming: T[]; past: T[] } {
  const upcoming = leagues
    .filter((l) => l.league_date >= today)
    .sort((a, b) => a.league_date.localeCompare(b.league_date));
  const past = leagues
    .filter((l) => l.league_date < today)
    .sort((a, b) => b.league_date.localeCompare(a.league_date));
  return { upcoming, past };
}
