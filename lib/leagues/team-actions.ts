"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { leagueAddress, type LeagueRef } from "@/lib/leagues/address";
import type { LeagueRole } from "@/lib/access/roles";
import type { TeamChangeResult } from "@/lib/organizations/team-rows";

/**
 * Gives a Member a Role on a League's team, or takes it away. RLS only lets
 * an Admin of the League's Organization do either, and the database writes
 * each change to the audit log. Taking a Role away ends its entry rather
 * than deleting it.
 */
export async function setTeamRole(
  league: LeagueRef,
  userId: string,
  role: LeagueRole,
  held: boolean,
): Promise<TeamChangeResult> {
  const { leagueId } = league;
  const supabase = await createClient();

  if (held) {
    const { error } = await supabase
      .from("league_team_member")
      .insert({ league_id: leagueId, user_id: userId, role });
    // 23505: they already hold it (someone else just gave it), which is
    // what was asked for.
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await endEntries(supabase, leagueId, userId).eq(
      "role",
      role,
    );
    if (error) return { error: error.message };
  }

  revalidatePath(leagueAddress(league, "team"));
  return {};
}

/** Takes every Role a Member holds on a League's team away. */
export async function removeFromTeam(
  league: LeagueRef,
  userId: string,
): Promise<TeamChangeResult> {
  const supabase = await createClient();
  const { error } = await endEntries(supabase, league.leagueId, userId);
  if (error) return { error: error.message };

  revalidatePath(leagueAddress(league, "team"));
  return {};
}

// The database stamps the real end time (league_team_member_only_ends).
function endEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: number,
  userId: string,
) {
  return supabase
    .from("league_team_member")
    .update({ ended_at: new Date().toISOString() })
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .is("ended_at", null);
}
