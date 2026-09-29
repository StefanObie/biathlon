"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { LeagueRole } from "@/lib/access/roles";
import type { TeamChangeResult } from "@/lib/organizations/team-rows";

/**
 * Gives a Member a Role on an Organization's Default team, or takes it
 * away. RLS only lets an Admin of the Organization do either, and the
 * database writes each change to the audit log. Existing Leagues keep their
 * own teams: only Leagues created afterwards start from the new Default
 * team.
 */
export async function setDefaultTeamRole(
  organizationId: number,
  userId: string,
  role: LeagueRole,
  held: boolean,
): Promise<TeamChangeResult> {
  const supabase = await createClient();

  if (held) {
    const { error } = await supabase
      .from("default_team_member")
      .insert({ organization_id: organizationId, user_id: userId, role });
    // 23505: they already hold it (someone else just gave it), which is
    // what was asked for.
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await supabase
      .from("default_team_member")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("role", role);
    if (error) return { error: error.message };
  }

  revalidatePath(`/organizations/${organizationId}/team`);
  return {};
}

/** Takes every Role a Member holds on the Default team away. */
export async function removeFromDefaultTeam(
  organizationId: number,
  userId: string,
): Promise<TeamChangeResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("default_team_member")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/organizations/${organizationId}/team`);
  return {};
}
