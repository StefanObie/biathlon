import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { LeagueAccess } from "@/lib/access/roles";

/**
 * What the signed-in Member holds on a League: whether they're an Admin of
 * its Organization, and their current Roles on its team. Null when they
 * can't see the League at all — not on its team and not an Admin, or no
 * such League. Cached per request, so the layout and page share one lookup.
 */
export const getLeagueAccess = cache(
  async (leagueId: number): Promise<LeagueAccess | null> => {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims.sub;
    if (!userId) return null;

    // RLS only shows the League to someone who holds a Role on it.
    const { data: league } = await supabase
      .from("league")
      .select("organization_id")
      .eq("id", leagueId)
      .maybeSingle();
    if (!league) return null;

    const [{ data: membership }, { data: team }] = await Promise.all([
      supabase
        .from("organization_member")
        .select("is_admin")
        .eq("organization_id", league.organization_id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("league_team_member")
        .select("role")
        .eq("league_id", leagueId)
        .eq("user_id", userId)
        .is("ended_at", null),
    ]);

    return {
      isAdmin: membership?.is_admin ?? false,
      roles: (team ?? []).map((entry) => entry.role),
    };
  },
);
