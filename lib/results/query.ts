import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export interface ResultsAthlete {
  athlete_no: number;
  full_name: string;
  age_group_code: string;
}

export interface ResultsHeat {
  run_heat: number;
  closed_at: string;
  athletes: ResultsAthlete[];
}

/** What league_results (supabase/schemas/core.sql) returns. */
export interface LeagueResults {
  name: string;
  organization_name: string;
  league_date: string;
  season: number;
  visibility: "public" | "protected";
  heats: ResultsHeat[];
}

/** The cache tag of one League's results page, by its current slug. */
export function resultsTag(slug: string): string {
  return `results:${slug}`;
}

/**
 * A League's published results by slug, or null when no Public or Protected
 * League has that slug. Read with no session at all, as a spectator would,
 * so nothing here can see more than the anonymous function returns. Cached
 * until a heat is closed or reopened, or the League's Visibility or slug
 * changes (see lib/results/actions.ts); the hour is only a safety net.
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
  return data as LeagueResults | null;
}
