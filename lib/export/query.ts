import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { ExportRow } from "@/lib/export/build-xml";

export interface ExportPreviewRow extends ExportRow {
  runHeat: number;
  swimStatus: string | null;
  runStatus: string | null;
  /** Athlete has run rows in heats other than their assigned entry.run_heat. */
  strayRunHeats: number[];
}

export interface ExportData {
  rows: ExportPreviewRow[];
  /** Entered athletes with no time on either leg — excluded from the file. */
  excludedCount: number;
  leagueName: string;
  leagueDate: string | null;
}

/**
 * Assembles the export roster for one league.
 *
 * Inclusion rule: an athlete appears if they have at least one of the two
 * times. Athletes entered but never captured are counted, not exported.
 *
 * Status is never used to filter or blank a time — see buildResultsXml.
 */
export async function getExportData(
  supabase: SupabaseClient<Database>,
  leagueId: number,
): Promise<ExportData> {
  const [{ data: entries }, { data: swims }, { data: runs }, { data: league }] =
    await Promise.all([
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
        .from("league")
        .select("name, league_date")
        .eq("id", leagueId)
        .maybeSingle(),
    ]);

  const swimByAthlete = new Map(
    (swims ?? []).map((swim) => [swim.athlete_no, swim]),
  );

  const runsByAthlete = new Map<number, NonNullable<typeof runs>>();
  for (const run of runs ?? []) {
    const existing = runsByAthlete.get(run.athlete_no);
    if (existing) existing.push(run);
    else runsByAthlete.set(run.athlete_no, [run]);
  }

  const rows: ExportPreviewRow[] = [];
  let excludedCount = 0;

  for (const entry of entries ?? []) {
    const swim = swimByAthlete.get(entry.athlete_no);
    const athleteRuns = runsByAthlete.get(entry.athlete_no) ?? [];

    // entry.run_heat is the athlete's official assignment, so that row wins;
    // any other heat is a capture artifact surfaced as a warning, not merged.
    const run = athleteRuns.find((r) => r.run_heat === entry.run_heat);
    const strayRunHeats = athleteRuns
      .filter((r) => r.run_heat !== entry.run_heat)
      .map((r) => r.run_heat);

    const swimTime = swim?.swim_time ?? null;
    const runTime = run?.run_time ?? null;

    if (swimTime === null && runTime === null) {
      excludedCount += 1;
      continue;
    }

    rows.push({
      athleteNo: entry.athlete_no,
      fullName: entry.athlete?.full_name ?? `Athlete ${entry.athlete_no}`,
      swimTime,
      runTime,
      runHeat: entry.run_heat,
      swimStatus: swim?.status ?? null,
      runStatus: run?.status ?? null,
      strayRunHeats,
    });
  }

  return {
    rows,
    excludedCount,
    leagueName: league?.name ?? `League ${leagueId}`,
    leagueDate: league?.league_date ?? null,
  };
}
