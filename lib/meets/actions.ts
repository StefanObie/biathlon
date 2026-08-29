"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseUploadedEntryFile } from "@/lib/import/parse-file";
import { parseEntryRows, resolveColumns } from "@/lib/import/entry-row";

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
  redirect(`/meets/${data.id}/import`);
}

export interface ImportEntriesState {
  imported?: number;
  errors?: { rowNumber: number; reason: string }[];
  fatalError?: string;
}

export async function importEntries(
  meetId: number,
  _prevState: ImportEntriesState,
  formData: FormData,
): Promise<ImportEntriesState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fatalError: "Choose a CSV or XLSX file to import." };
  }

  let rawRows: Record<string, string>[];
  try {
    rawRows = await parseUploadedEntryFile(file);
  } catch (err) {
    return {
      fatalError: err instanceof Error ? err.message : "Could not read file.",
    };
  }

  if (rawRows.length === 0) {
    return { fatalError: "File has no data rows." };
  }

  const columns = resolveColumns(Object.keys(rawRows[0]));
  if (!columns) {
    return {
      fatalError:
        "Couldn't find all required columns (Age Group, Athlete name, Athlete No, Run Heat, Swim Heat, Swim Lane).",
    };
  }

  const { parsed, errors } = parseEntryRows(rawRows, columns);

  if (parsed.length === 0) {
    return { imported: 0, errors };
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

  revalidatePath(`/meets/${meetId}/roster`);
  return { imported: parsed.length, errors };
}
