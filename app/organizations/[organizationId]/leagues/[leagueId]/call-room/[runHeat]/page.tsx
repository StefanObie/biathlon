import { Suspense } from "react";
import { notFound } from "next/navigation";

import { toHeatClosed } from "@/lib/capture/heat-closed";
import { createClient } from "@/lib/supabase/server";
import { loadOrganizationAthletes } from "@/lib/leagues/organization-athletes";
import { canUse, heatModes } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { CallRoom } from "@/components/call-room/call-room";

export default function CallRoomHeatPage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    leagueId: string;
    runHeat: string;
  }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading heat…</p>}>
      <CallRoomHeatSection params={params} />
    </Suspense>
  );
}

async function CallRoomHeatSection({
  params,
}: {
  params: Promise<{
    organizationId: string;
    leagueId: string;
    runHeat: string;
  }>;
}) {
  const { organizationId, leagueId, runHeat } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  const runHeatNum = Number(runHeat);
  if (
    !Number.isInteger(organizationIdNum) ||
    !Number.isInteger(leagueIdNum) ||
    !Number.isInteger(runHeatNum)
  ) {
    notFound();
  }

  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);
  if (!access || !canUse(access, "call-room")) return <NoAccess />;

  const supabase = await createClient();

  const [
    { data: leagueEntries, error: entriesError },
    { data: checkIns, error: checkInsError },
    { data: leagueRace, error: leagueRaceError },
    { data: organizationAthletes, error: athletesError },
  ] = await Promise.all([
    // Whole league, so a number belonging to another heat is recognised.
    supabase
      .from("entry")
      .select("athlete_no, run_heat, athlete(full_name)")
      .eq("league_id", leagueIdNum),
    supabase
      .from("call_room_check_in")
      .select("athlete_no, run_heat")
      .eq("league_id", leagueIdNum),
    supabase
      .from("league_race")
      .select("closed_at, closed_by")
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .maybeSingle(),
    // A Caller can add any athlete of the Organization who isn't on the
    // Start list as a Late entry, so the lookup has them all.
    loadOrganizationAthletes(supabase, organizationIdNum),
  ]);

  const error = entriesError ?? checkInsError ?? athletesError;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;

  const entries = (leagueEntries ?? []).map((e) => ({
    athleteNo: e.athlete_no,
    fullName: e.athlete?.full_name ?? "",
    runHeat: e.run_heat,
  }));

  if (!entries.some((a) => a.runHeat === runHeatNum)) {
    return (
      <p className="text-sm text-muted-foreground">
        No athletes assigned to run heat {runHeatNum}.
      </p>
    );
  }

  const heats = [...new Set(entries.map((a) => a.runHeat))].sort(
    (a, b) => a - b,
  );

  return (
    <CallRoom
      organizationId={organizationIdNum}
      leagueId={leagueIdNum}
      runHeat={runHeatNum}
      modes={heatModes(access)}
      heats={heats}
      entries={entries}
      athletes={organizationAthletes}
      remoteCheckIns={(checkIns ?? []).map((c) => ({
        athleteNo: c.athlete_no,
        runHeat: c.run_heat,
      }))}
      remoteHeatClosed={leagueRaceError ? undefined : toHeatClosed(leagueRace)}
    />
  );
}
