/**
 * Today's date as `YYYY-MM-DD`, in South African time: the same "today" the
 * database uses for the Featured league (featured_league in
 * supabase/schemas/core.sql), so the app and the database never disagree
 * between midnight and 02:00.
 */
export function leagueToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
  }).format(now);
}

/** Whether a League's `YYYY-MM-DD` date is today, in South African time. */
export function isLeagueToday(leagueDate: string, now?: Date): boolean {
  return leagueDate === leagueToday(now);
}
