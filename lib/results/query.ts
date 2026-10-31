import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

import type { PoolLength } from "./points";
import type { ResultsAthleteRow, ResultsPointsRow } from "./shape";

/** What league_results (supabase/schemas/core.sql) returns. */
export interface LeagueResults {
  league_id: number;
  name: string;
  organization_name: string;
  league_date: string;
  season: number;
  visibility: "public" | "protected";
  /** The pool the swim session was held in, which decides swim points. */
  pool_length_m: PoolLength;
  /** Run heats in the League, and how many of them are Closed. */
  heats_total: number;
  heats_closed: number;
  athletes: ResultsAthleteRow[];
  points_table: ResultsPointsRow[];
}

/** The cache tag of one League's results page, by its current slug. */
export function resultsTag(slug: string): string {
  return `results:${slug}`;
}

/** The same page's cache tag by League, for whoever can't know the slug. */
export function leagueResultsTag(leagueId: number): string {
  return `results-league:${leagueId}`;
}

/**
 * A League's published results by slug, or null when no Public or Protected
 * League has that slug. Read with no session at all, as a spectator would,
 * so nothing here can see more than the anonymous function returns. Cached
 * until a heat is closed or reopened, the League's Visibility or slug
 * changes (see lib/results/actions.ts), or an entered athlete's age is
 * corrected or given on a Late entry (see lib/leagues/actions.ts); the hour is
 * only a safety net.
 */
export async function getLeagueResults(
  slug: string,
): Promise<LeagueResults | null> {
  "use cache";
  cacheTag(resultsTag(slug));
  cacheLife("hours");

  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc("league_results", { slug });
  // A failed read is not "no such League": throwing keeps it out of the
  // cache and shows the error page instead of a cached not-found.
  if (error) throw new Error(error.message);
  const results = data as LeagueResults | null;
  if (results) cacheTag(leagueResultsTag(results.league_id));
  return results;
}
