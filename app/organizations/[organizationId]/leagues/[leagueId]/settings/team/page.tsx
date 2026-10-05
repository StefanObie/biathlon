import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { TeamRoles } from "@/components/organizations/team-roles";
import { teamRows } from "@/lib/organizations/team-rows";
import { removeFromTeam, setTeamRole } from "@/lib/leagues/team-actions";

export default function LeagueTeamPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading team…</p>}>
      <LeagueTeamSection params={params} />
    </Suspense>
  );
}

async function LeagueTeamSection({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  const { organizationId, leagueId } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(organizationIdNum) || !Number.isInteger(leagueIdNum)) {
    notFound();
  }

  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);
  if (!access || !canUse(access, "team")) return <NoAccess />;

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("league")
    .select("organization_id")
    .eq("id", leagueIdNum)
    .single();
  if (!league) return <NoAccess />;

  const [{ data: members, error }, { data: team }] = await Promise.all([
    supabase.rpc("organization_members", { org_id: league.organization_id }),
    supabase
      .from("league_team_member")
      .select("user_id, role")
      .eq("league_id", leagueIdNum)
      .is("ended_at", null),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  return (
    <TeamRoles
      title="Team"
      description={
        <>
          Only the Members on this league&apos;s team, and the
          organization&apos;s Admins, can open it. Officials can do everything
          but manage the team; Timekeepers use the Timer screen, Placers the
          Position screen, and Callers the Call room screen.
        </>
      }
      rows={teamRows(members ?? [], team ?? [])}
      setRole={setTeamRole.bind(null, {
        organizationId: organizationIdNum,
        leagueId: leagueIdNum,
      })}
      remove={removeFromTeam.bind(null, {
        organizationId: organizationIdNum,
        leagueId: leagueIdNum,
      })}
    />
  );
}
