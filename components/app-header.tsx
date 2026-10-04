import { cookies } from "next/headers";

import { AppHeaderNav } from "@/components/app-header-nav";
import { createClient } from "@/lib/supabase/server";
import {
  ORGANIZATION_COOKIE,
  rememberedOrganizationId,
} from "@/lib/organizations/landing";

/** Loads what the header switchers list, for the signed-in user. */
export async function AppHeader() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const email = claims?.claims.email;

  const [{ data: memberships }, { data: leagues }, cookieStore] =
    await Promise.all([
      supabase
        .from("organization_member")
        .select("is_admin, organization(id, name)")
        .eq("user_id", userId ?? ""),
      supabase.from("league").select("id, name, league_date, organization_id"),
      cookies(),
    ]);

  const organizations = (memberships ?? [])
    .map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      isAdmin: m.is_admin,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppHeaderNav
      organizations={organizations}
      leagues={(leagues ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        leagueDate: l.league_date,
        organizationId: l.organization_id,
      }))}
      remembered={rememberedOrganizationId(
        cookieStore.get(ORGANIZATION_COOKIE)?.value,
      )}
      email={typeof email === "string" ? email : null}
    />
  );
}
