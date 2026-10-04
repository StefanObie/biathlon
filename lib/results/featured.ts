import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** What featured_league (supabase/schemas/core.sql) returns. */
export interface FeaturedLeague {
  name: string;
  organization_name: string;
  league_date: string;
  results_slug: string;
}

/**
 * The Featured league, or null when none qualifies. Read with no session, as
 * a visitor would. It changes when a League is added or its date arrives, so
 * a few minutes of caching is enough.
 */
export async function getFeaturedLeague(): Promise<FeaturedLeague | null> {
  "use cache";
  cacheLife("minutes");

  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc("featured_league");
  // A failed read is not "no Featured league": throwing keeps it out of the cache.
  if (error) throw new Error(error.message);
  return data[0] ?? null;
}
