import { cookies } from "next/headers";

import { AppNavigation } from "@/components/app-navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ORGANIZATION_COOKIE,
  rememberedOrganizationId,
  resolveLanding,
} from "@/lib/organizations/landing";
import { leagueToday } from "@/lib/leagues/today";

/** Loads what the fixed navigation lists, for the signed-in user. */
export async function AppHeader() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? "";
  const email = claims?.claims.email;

  const [
    { data: memberships },
    { data: leagues },
    { data: team },
    cookieStore,
  ] = await Promise.all([
    supabase
      .from("organization_member")
      .select("is_admin, organization(id, name)")
      .eq("user_id", userId),
    supabase.from("league").select("id, name, league_date, organization_id"),
    supabase
      .from("league_team_member")
      .select("league_id, role")
      .eq("user_id", userId)
      .is("ended_at", null),
    cookies(),
  ]);

  const organizations = (memberships ?? [])
    .map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      isAdmin: m.is_admin,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // The remembered Organization, or a Member's only one.
  const landing = resolveLanding(
    organizations.map((o) => o.id),
    rememberedOrganizationId(cookieStore.get(ORGANIZATION_COOKIE)?.value),
  );

  return (
    <AppNavigation
      organizations={organizations}
      leagues={(leagues ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        leagueDate: l.league_date,
        organizationId: l.organization_id,
      }))}
      team={(team ?? []).map((t) => ({ leagueId: t.league_id, role: t.role }))}
      remembered={landing === "picker" ? null : landing}
      today={leagueToday()}
      email={typeof email === "string" ? email : null}
    />
  );
}
