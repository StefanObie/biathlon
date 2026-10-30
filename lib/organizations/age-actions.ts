"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  reconcileAges,
  type AgeUpdate,
  type ParsedAgeFile,
  type ReconciledAges,
} from "@/lib/import/age-file";
import { leagueResultsTag } from "@/lib/results/query";

// Keeps each request's list of numbers short, and each result under max_rows.
const LOOKUP_SIZE = 500;

/**
 * The preview of an age file: which rows would save, which wouldn't, and what
 * to follow up on. It reads what the caller's Role already lets them read, and
 * writes nothing. Whether they may save is for save_athlete_ages.
 */
export async function previewAgeUpload(
  organizationId: number,
  parsed: ParsedAgeFile,
): Promise<{ error: string } | { preview: ReconciledAges }> {
  const supabase = await createClient();
  const numbers = parsed.rows.map((row) => row.athleteNo);

  const stored = [];
  for (let start = 0; start < numbers.length; start += LOOKUP_SIZE) {
    const athleteNos = numbers.slice(start, start + LOOKUP_SIZE);
    const [athletes, ageGroups] = await Promise.all([
      supabase
        .from("athlete")
        .select("athlete_no, gender")
        .eq("organization_id", organizationId)
        .in("athlete_no", athleteNos),
      supabase.rpc("latest_age_groups", {
        org_id: organizationId,
        athlete_nos: athleteNos,
      }),
    ]);
    const error = athletes.error ?? ageGroups.error;
    if (error) return { error: `Failed to check athletes: ${error.message}` };

    const latest = new Map(
      ageGroups.data?.map((g) => [g.athlete_no, g.age_group_code]),
    );
    for (const athlete of athletes.data ?? []) {
      stored.push({
        athleteNo: athlete.athlete_no,
        gender: athlete.gender,
        latestAgeGroupCode: latest.get(athlete.athlete_no) ?? null,
      });
    }
  }

  return { preview: reconcileAges(parsed, stored) };
}

/**
 * Saves a confirmed preview, then refreshes the Organization's cached results
 * and its pages, since Points in every League use these birth years.
 */
export async function saveAgeUpload(
  organizationId: number,
  yearTaken: number,
  updates: AgeUpdate[],
): Promise<{ error: string } | { updated: number }> {
  const supabase = await createClient();
  const { data: updated, error } = await supabase.rpc("save_athlete_ages", {
    org_id: organizationId,
    year_taken: yearTaken,
    ages: updates.map((update) => ({
      athlete_no: update.athleteNo,
      birth_year: update.birthYear,
    })),
  });
  if (error) return { error: error.message };

  const { data: leagues } = await supabase
    .from("league")
    .select("id")
    .eq("organization_id", organizationId);
  for (const { id } of leagues ?? []) updateTag(leagueResultsTag(id));
  revalidatePath(`/organizations/${organizationId}`, "layout");

  return { updated };
}
