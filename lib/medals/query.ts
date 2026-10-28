import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { PoolLength } from "@/lib/results/points";
import type { ResultsPointsRow } from "@/lib/results/shape";

import {
  medalBoard,
  type MedalAthleteRow,
  type MedalGroup,
  type MedalPresentation,
  type SavedMedal,
} from "./board";

/** What league_medals (supabase/schemas/core.sql) returns. */
interface LeagueMedals {
  pool_length_m: PoolLength;
  athletes: MedalAthleteRow[];
  points_table: ResultsPointsRow[];
}

/**
 * Each group's podium and Medals presented mark, read fresh: the Medals
 * screen is never cached, since an Official judges from it whether it is
 * safe to present.
 */
export async function getMedalBoard(
  supabase: SupabaseClient<Database>,
  leagueId: number,
): Promise<MedalGroup[]> {
  const [medals, presentations] = await Promise.all([
    supabase.rpc("league_medals", { target_league_id: leagueId }),
    supabase
      .from("medal_presentation")
      .select("gender, age_group_code, podium, presented_at")
      .eq("league_id", leagueId),
  ]);
  if (medals.error) throw new Error(medals.error.message);
  if (presentations.error) throw new Error(presentations.error.message);

  const data = medals.data as unknown as LeagueMedals;
  return medalBoard(
    data.athletes,
    data.points_table,
    data.pool_length_m,
    presentations.data.map((p): MedalPresentation => ({
      ...p,
      podium: p.podium as unknown as SavedMedal[],
    })),
  );
}
