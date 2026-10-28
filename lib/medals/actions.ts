"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { leagueAddress, type LeagueRef } from "@/lib/leagues/address";
import type { Gender } from "@/lib/results/shape";

import type { SavedMedal } from "./board";

export interface MedalsResult {
  error?: string;
}

const NOT_OFFICIAL = "Only an Official of the League can do this.";

/**
 * Marks a group's medals as presented, saving the podium the Official saw,
 * which is the one they handed out. Marking a group again replaces it, and
 * the database stamps who marked it and when. RLS
 * only lets an Official write, so a write that changes nothing means the
 * caller isn't one.
 */
export async function markMedalsPresented(
  ref: LeagueRef,
  gender: Gender,
  ageGroupCode: string,
  podium: SavedMedal[],
): Promise<MedalsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medal_presentation")
    .upsert({
      league_id: ref.leagueId,
      gender,
      age_group_code: ageGroupCode,
      podium: podium.map(({ athlete_no, medal_place }) => ({
        athlete_no,
        medal_place,
      })),
    })
    .select("league_id");
  if (error) {
    return { error: error.code === "42501" ? NOT_OFFICIAL : error.message };
  }
  if (data.length === 0) return { error: NOT_OFFICIAL };
  revalidatePath(leagueAddress(ref, "medals"));
  return {};
}

/** Clears a group's Medals presented mark. */
export async function clearMedalsPresented(
  ref: LeagueRef,
  gender: Gender,
  ageGroupCode: string,
): Promise<MedalsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medal_presentation")
    .delete()
    .eq("league_id", ref.leagueId)
    .eq("gender", gender)
    .eq("age_group_code", ageGroupCode)
    .select("league_id");
  if (error) return { error: error.message };
  // RLS hides the row from anyone but an Official, so nothing is deleted.
  if (data.length === 0) return { error: NOT_OFFICIAL };
  revalidatePath(leagueAddress(ref, "medals"));
  return {};
}
