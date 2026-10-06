import { Suspense } from "react";
import { notFound } from "next/navigation";

import { toHeatClosed } from "@/lib/capture/heat-closed";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationAthlete } from "@/lib/scan/position";
import { canUse, heatModes } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { PositionCapture } from "@/components/capture/position-capture";

export default function PositionHeatPage({
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
      <PositionHeatSection params={params} />
    </Suspense>
  );
}

async function PositionHeatSection({
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
  if (!access || !canUse(access, "position")) return <NoAccess />;

  const supabase = await createClient();

  const [
    { data: leagueEntries, error: entriesError },
    { data: captures },
    { data: leagueRace, error: leagueRaceError },
    { data: organizationAthletes, error: athletesError },
  ] = await Promise.all([
    // Whole league, not just this heat: an operator can log an athlete who
    // ran in the wrong heat (confirmed on the capture screen) — reassigning
    // them to the correct heat happens later, in reconciliation.
    supabase
      .from("entry")
      .select("athlete_no, run_heat, athlete(full_name)")
      .eq("league_id", leagueIdNum),
    supabase
      .from("position_capture")
      .select(
        "id, position, athlete_no, voided, void_reason, scanned_at, device_id",
      )
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .order("position"),
    supabase
      .from("league_race")
      .select("closed_at, closed_by")
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .maybeSingle(),
    // Any athlete of the Organization can be captured (a Late entry is made
    // for them in reconciliation), so the lookup has them all for offline.
    loadOrganizationAthletes(supabase, organizationIdNum),
  ]);

  if (entriesError) {
    return <p className="text-sm text-destructive">{entriesError.message}</p>;
  }
  if (athletesError) {
    return <p className="text-sm text-destructive">{athletesError.message}</p>;
  }

  const leagueRoster = (leagueEntries ?? []).map((e) => ({
    athleteNo: e.athlete_no,
    fullName: e.athlete?.full_name ?? "",
    runHeat: e.run_heat,
  }));

  if (!leagueRoster.some((a) => a.runHeat === runHeatNum)) {
    return (
      <p className="text-sm text-muted-foreground">
        No athletes assigned to run heat {runHeatNum}.
      </p>
    );
  }

  const heats = [...new Set(leagueRoster.map((a) => a.runHeat))].sort(
    (a, b) => a - b,
  );

  return (
    <PositionCapture
      organizationId={organizationIdNum}
      leagueId={leagueIdNum}
      runHeat={runHeatNum}
      modes={heatModes(access)}
      heats={heats}
      leagueRoster={leagueRoster}
      athletes={organizationAthletes}
      remoteCaptures={captures ?? []}
      remoteHeatClosed={leagueRaceError ? undefined : toHeatClosed(leagueRace)}
    />
  );
}

// The API returns at most max_rows (1000) rows a request, and an
// Organization's athletes outgrow that over the seasons, so read them a page
// at a time rather than silently treating the rest as unknown.
const ATHLETE_PAGE = 1000;

async function loadOrganizationAthletes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: number,
): Promise<{ data: OrganizationAthlete[]; error: { message: string } | null }> {
  const athletes: OrganizationAthlete[] = [];
  for (let from = 0; ; from += ATHLETE_PAGE) {
    const { data, error } = await supabase
      .from("athlete")
      .select("athlete_no, full_name")
      .eq("organization_id", organizationId)
      .order("athlete_no")
      .range(from, from + ATHLETE_PAGE - 1);
    if (error) return { data: [], error };
    for (const a of data) {
      athletes.push({ athleteNo: a.athlete_no, fullName: a.full_name });
    }
    if (data.length < ATHLETE_PAGE) return { data: athletes, error: null };
  }
}
