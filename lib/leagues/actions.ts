"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ParsedEntryRow } from "@/lib/import/entry-row";
import { parseAgeGroup } from "@/lib/import/age-group";

export interface CreateLeagueState {
  error?: string;
}

export async function createLeague(
  _prevState: CreateLeagueState,
  formData: FormData,
): Promise<CreateLeagueState> {
  const name = String(formData.get("name") ?? "").trim();
  const leagueDate = String(formData.get("leagueDate") ?? "").trim();
  const season = Number(formData.get("season"));

  if (!name || !leagueDate || !Number.isInteger(season)) {
    return { error: "Name, date, and season are all required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league")
    .insert({ name, league_date: leagueDate, season })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create league." };
  }

  revalidatePath("/leagues");
  redirect(`/leagues/${data.id}/start-list`);
}

export interface SaveStartListState {
  saved?: number;
  fatalError?: string;
}

/**
 * Overwrites the league's start list with rows already parsed client-side
 * (see components/leagues/start-list.tsx) — the source file is finalized data
 * from a third party, so there's no server-side re-validation step, just
 * upsert-by-athlete-number.
 */
export async function saveStartList(
  leagueId: number,
  parsed: ParsedEntryRow[],
): Promise<SaveStartListState> {
  if (parsed.length === 0) {
    return { fatalError: "No rows to save." };
  }

  const supabase = await createClient();

  const athletes = parsed.map((p) => ({
    athlete_no: p.row.athleteNo,
    full_name: p.row.fullName,
    gender: p.gender,
  }));
  const { error: athleteError } = await supabase
    .from("athlete")
    .upsert(athletes);
  if (athleteError) {
    return { fatalError: `Failed to save athletes: ${athleteError.message}` };
  }

  const entries = parsed.map((p) => ({
    league_id: leagueId,
    athlete_no: p.row.athleteNo,
    run_heat: p.row.runHeat,
    swim_heat: p.row.swimHeat,
    swim_lane: p.row.swimLane,
    age_group_code: p.ageGroupCode,
  }));
  const { error: entryError } = await supabase
    .from("entry")
    .upsert(entries, { onConflict: "league_id,athlete_no" });
  if (entryError) {
    return { fatalError: `Failed to save entries: ${entryError.message}` };
  }

  revalidatePath(`/leagues/${leagueId}/start-list`);
  return { saved: parsed.length };
}

export interface AddWalkUpAthleteState {
  error?: string;
  saved?: boolean;
}

/**
 * Registers a single athlete who wasn't in the imported start list (a
 * walk-up on race day). Same two-step upsert as saveStartList, just for one
 * row — kept as its own action rather than reusing saveStartList with a
 * one-element array because that action's whole-list "replace" framing
 * (and its uploaded-file-trusts-the-data doc comment) doesn't fit a
 * hand-entered single row, which does need real validation here.
 */
export async function addWalkUpAthlete(
  leagueId: number,
  _prevState: AddWalkUpAthleteState,
  formData: FormData,
): Promise<AddWalkUpAthleteState> {
  const athleteNo = Number(formData.get("athleteNo"));
  const fullName = String(formData.get("fullName") ?? "").trim();
  const ageGroupLabel = String(formData.get("ageGroupLabel") ?? "").trim();
  const runHeat = Number(formData.get("runHeat"));
  const swimHeat = Number(formData.get("swimHeat"));
  const swimLane = Number(formData.get("swimLane"));

  if (!Number.isInteger(athleteNo) || athleteNo <= 0) {
    return { error: "Athlete number must be a positive whole number." };
  }
  if (!fullName) {
    return { error: "Athlete name is required." };
  }
  const ageGroup = parseAgeGroup(ageGroupLabel);
  if (!ageGroup) {
    return { error: "Choose an age group." };
  }
  if (!Number.isInteger(runHeat) || runHeat <= 0) {
    return { error: "Run heat must be a positive whole number." };
  }
  if (!Number.isInteger(swimHeat) || swimHeat <= 0) {
    return { error: "Swim heat must be a positive whole number." };
  }
  if (!Number.isInteger(swimLane) || swimLane <= 0) {
    return { error: "Swim lane must be a positive whole number." };
  }

  const supabase = await createClient();

  const { error: athleteError } = await supabase.from("athlete").upsert({
    athlete_no: athleteNo,
    full_name: fullName,
    gender: ageGroup.gender,
  });
  if (athleteError) {
    return { error: `Failed to save athlete: ${athleteError.message}` };
  }

  const { error: entryError } = await supabase.from("entry").upsert(
    {
      league_id: leagueId,
      athlete_no: athleteNo,
      run_heat: runHeat,
      swim_heat: swimHeat,
      swim_lane: swimLane,
      age_group_code: ageGroup.code,
    },
    { onConflict: "league_id,athlete_no" },
  );
  if (entryError) {
    return { error: `Failed to save entry: ${entryError.message}` };
  }

  revalidatePath(`/leagues/${leagueId}/start-list`);
  return { saved: true };
}
