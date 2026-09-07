"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ParsedEntryRow } from "@/lib/import/entry-row";

export interface CreateMeetState {
  error?: string;
}

export async function createMeet(
  _prevState: CreateMeetState,
  formData: FormData,
): Promise<CreateMeetState> {
  const name = String(formData.get("name") ?? "").trim();
  const meetDate = String(formData.get("meetDate") ?? "").trim();
  const season = Number(formData.get("season"));

  if (!name || !meetDate || !Number.isInteger(season)) {
    return { error: "Name, date, and season are all required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meet")
    .insert({ name, meet_date: meetDate, season })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create meet." };
  }

  revalidatePath("/meets");
  redirect(`/meets/${data.id}/start-list`);
}

export interface SaveStartListState {
  saved?: number;
  fatalError?: string;
}

/**
 * Overwrites the meet's start list with rows already parsed client-side
 * (see components/meets/start-list.tsx) — the source file is finalized data
 * from a third party, so there's no server-side re-validation step, just
 * upsert-by-athlete-number.
 */
export async function saveStartList(
  meetId: number,
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
    meet_id: meetId,
    athlete_no: p.row.athleteNo,
    run_heat: p.row.runHeat,
    swim_heat: p.row.swimHeat,
    swim_lane: p.row.swimLane,
    age_group_code: p.ageGroupCode,
  }));
  const { error: entryError } = await supabase
    .from("entry")
    .upsert(entries, { onConflict: "meet_id,athlete_no" });
  if (entryError) {
    return { fatalError: `Failed to save entries: ${entryError.message}` };
  }

  revalidatePath(`/meets/${meetId}/start-list`);
  return { saved: parsed.length };
}
