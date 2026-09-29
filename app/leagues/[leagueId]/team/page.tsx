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
  params: Promise<{ leagueId: string }>;
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
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(leagueIdNum)) notFound();

  const access = await getLeagueAccess(leagueIdNum);
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
      setRole={setTeamRole.bind(null, leagueIdNum)}
      remove={removeFromTeam.bind(null, leagueIdNum)}
    />
  );
}
