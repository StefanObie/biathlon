import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  selectExportRows,
  type ExportSelection,
} from "@/lib/export/select-rows";

export interface ExportData extends ExportSelection {
  leagueName: string;
  leagueDate: string | null;
}

/**
 * Loads one league's entries, times and closed heats, and picks the export
 * roster from them with selectExportRows.
 */
export async function getExportData(
  supabase: SupabaseClient<Database>,
  leagueId: number,
): Promise<ExportData> {
  const [
    { data: entries },
    { data: swims },
    { data: runs },
    { data: closedRaces },
    { data: league },
  ] = await Promise.all([
    supabase
      .from("entry")
      .select("athlete_no, run_heat, athlete(full_name)")
      .eq("league_id", leagueId)
      .order("athlete_no"),
    supabase
      .from("swim_result")
      .select("athlete_no, swim_time, status")
      .eq("league_id", leagueId),
    supabase
      .from("run_result")
      .select("athlete_no, run_heat, run_time, status")
      .eq("league_id", leagueId),
    supabase
      .from("league_race")
      .select("run_heat")
      .eq("league_id", leagueId)
      .not("closed_at", "is", null),
    supabase
      .from("league")
      .select("name, league_date")
      .eq("id", leagueId)
      .maybeSingle(),
  ]);

  const selection = selectExportRows({
    entries: (entries ?? []).map((entry) => ({
      athleteNo: entry.athlete_no,
      runHeat: entry.run_heat,
      fullName: entry.athlete?.full_name ?? `Athlete ${entry.athlete_no}`,
    })),
    swims: (swims ?? []).map((swim) => ({
      athleteNo: swim.athlete_no,
      swimTime: swim.swim_time,
      status: swim.status,
    })),
    runs: (runs ?? []).map((run) => ({
      athleteNo: run.athlete_no,
      runHeat: run.run_heat,
      runTime: run.run_time,
      status: run.status,
    })),
    closedHeats: new Set((closedRaces ?? []).map((race) => race.run_heat)),
  });

  return {
    ...selection,
    leagueName: league?.name ?? `League ${leagueId}`,
    leagueDate: league?.league_date ?? null,
  };
}
