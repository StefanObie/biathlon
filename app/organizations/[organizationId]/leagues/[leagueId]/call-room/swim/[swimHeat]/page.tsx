import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse, heatModes } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { SwimCallRoom } from "@/components/call-room/swim-call-room";

export default function SwimCallRoomHeatPage({
  params,
}: {
  params: Promise<{
    organizationId: string;
    leagueId: string;
    swimHeat: string;
  }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading heat…</p>}>
      <SwimCallRoomHeatSection params={params} />
    </Suspense>
  );
}

async function SwimCallRoomHeatSection({
  params,
}: {
  params: Promise<{
    organizationId: string;
    leagueId: string;
    swimHeat: string;
  }>;
}) {
  const { organizationId, leagueId, swimHeat } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  const swimHeatNum = Number(swimHeat);
  if (
    !Number.isInteger(organizationIdNum) ||
    !Number.isInteger(leagueIdNum) ||
    !Number.isInteger(swimHeatNum)
  ) {
    notFound();
  }

  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);
  if (!access || !canUse(access, "call-room")) return <NoAccess />;

  const supabase = await createClient();

  const [
    { data: leagueEntries, error: entriesError },
    { data: checkIns, error: checkInsError },
  ] = await Promise.all([
    // Whole league, so a number belonging to another swim heat is recognised.
    supabase
      .from("entry")
      .select("athlete_no, swim_heat, swim_lane, athlete(full_name)")
      .eq("league_id", leagueIdNum),
    supabase
      .from("swim_call_room_check_in")
      .select("athlete_no, swim_heat")
      .eq("league_id", leagueIdNum),
  ]);

  const error = entriesError ?? checkInsError;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;

  const entries = (leagueEntries ?? []).map((e) => ({
    athleteNo: e.athlete_no,
    fullName: e.athlete?.full_name ?? "",
    swimHeat: e.swim_heat,
    swimLane: e.swim_lane,
  }));

  const swimHeats = [
    ...new Set(
      entries.flatMap((e) => (e.swimHeat === null ? [] : [e.swimHeat])),
    ),
  ].sort((a, b) => a - b);

  if (!swimHeats.includes(swimHeatNum)) {
    return (
      <p className="text-sm text-muted-foreground">
        No athletes assigned to swim heat {swimHeatNum}.
      </p>
    );
  }

  return (
    <SwimCallRoom
      organizationId={organizationIdNum}
      leagueId={leagueIdNum}
      swimHeat={swimHeatNum}
      modes={heatModes(access)}
      swimHeats={swimHeats}
      entries={entries}
      remoteCheckIns={(checkIns ?? []).map((c) => ({
        athleteNo: c.athlete_no,
        swimHeat: c.swim_heat,
      }))}
    />
  );
}
