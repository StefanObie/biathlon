import { Suspense } from "react";
import { notFound } from "next/navigation";

import { toHeatClosed } from "@/lib/capture/heat-closed";
import { createClient } from "@/lib/supabase/server";
import { canUse, heatModes } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { loadOrganizationAthletes } from "@/lib/leagues/organization-athletes";
import { NoAccess } from "@/components/leagues/no-access";
import { ResultsLink } from "@/components/leagues/results-link";
import { Reconcile } from "@/components/capture/reconcile";

export default function ReconcileHeatPage({
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
      <ReconcileHeatSection params={params} />
    </Suspense>
  );
}

async function ReconcileHeatSection({
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
  if (!access || !canUse(access, "reconcile")) return <NoAccess />;

  const supabase = await createClient();

  const [
    { data: leagueEntries, error: entriesError },
    { data: positionCaptures },
    { data: timeCaptures },
    { data: runResults },
    { data: leagueRunResults },
    { data: notes },
    { data: leagueRace, error: leagueRaceError },
    { data: league },
    { data: team },
    { data: checkIns },
    { data: organizationAthletes, error: athletesError },
  ] = await Promise.all([
    // Whole league, not just this heat: reassigning an athlete or logging
    // one who ran outside their assigned heat (§4.5) needs to search past
    // this heat's own roster.
    supabase
      .from("entry")
      .select("athlete_no, run_heat, athlete(full_name)")
      .eq("league_id", leagueIdNum),
    supabase
      .from("position_capture")
      .select(
        "id, position, athlete_no, voided, void_reason, scanned_at, device_id, author_id",
      )
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .order("position"),
    supabase
      .from("time_capture")
      .select(
        "id, seq, elapsed_time, is_placeholder, voided, void_reason, captured_at, device_id, author_id",
      )
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .order("seq"),
    supabase
      .from("run_result")
      .select(
        "athlete_no, run_time, status, source, overridden_by, override_reason",
      )
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum),
    // Whole-league run_result, scoped to just the athletes on this heat's
    // roster, so the "already has a time in another heat" check (§4.5) can
    // compare without a second round trip per athlete.
    supabase
      .from("run_result")
      .select("athlete_no, run_heat")
      .eq("league_id", leagueIdNum)
      .neq("run_heat", runHeatNum),
    // Operator notes for this heat, oldest first: a later note correcting
    // an earlier one has to read after it (#19).
    supabase
      .from("operator_note")
      .select("id, anchor, screen, body, created_at")
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .order("created_at"),
    supabase
      .from("league_race")
      .select("closed_at, closed_by")
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .maybeSingle(),
    supabase
      .from("league")
      .select("name, organization_id")
      .eq("id", leagueIdNum)
      .maybeSingle(),
    supabase
      .from("league_team_member")
      .select("user_id")
      .eq("league_id", leagueIdNum)
      .is("ended_at", null),
    // Whole league: a check-in at another heat is a hint for this one.
    supabase
      .from("call_room_check_in")
      .select("athlete_no, run_heat")
      .eq("league_id", leagueIdNum),
    // Any athlete of the Organization can be assigned; one not on the Start
    // list becomes a Late entry when the heat is saved.
    loadOrganizationAthletes(supabase, organizationIdNum),
  ]);

  // Who can still capture on the League, to flag captures by anyone who
  // has since left its team (#36): the team, and the Organization's Admins.
  const { data: admins } = league
    ? await supabase
        .from("organization_member")
        .select("user_id")
        .eq("organization_id", league.organization_id)
        .eq("is_admin", true)
    : { data: [] };
  const onTeam = [...(team ?? []), ...(admins ?? [])].map((m) => m.user_id);

  if (entriesError) {
    return <p className="text-sm text-destructive">{entriesError.message}</p>;
  }
  if (athletesError) {
    return <p className="text-sm text-destructive">{athletesError.message}</p>;
  }

  const heats = [...new Set((leagueEntries ?? []).map((e) => e.run_heat))];
  if (!heats.includes(runHeatNum)) {
    return (
      <p className="text-sm text-muted-foreground">
        No athletes assigned to run heat {runHeatNum}.
      </p>
    );
  }

  const sortedHeats = [...heats].sort((a, b) => a - b);

  const leagueRoster = (leagueEntries ?? []).map((e) => ({
    athleteNo: e.athlete_no,
    fullName: e.athlete?.full_name ?? `Athlete ${e.athlete_no}`,
    runHeat: e.run_heat,
  }));
  const roster = (leagueEntries ?? [])
    .filter((e) => e.run_heat === runHeatNum)
    .map((e) => ({
      athleteNo: e.athlete_no,
      fullName: e.athlete?.full_name ?? `Athlete ${e.athlete_no}`,
    }));

  return (
    <>
      <div className="px-4 pt-2">
        <ResultsLink
          organizationId={organizationIdNum}
          leagueId={leagueIdNum}
          isAdmin={access.isAdmin}
        />
      </div>
      <Reconcile
        organizationId={organizationIdNum}
        leagueId={leagueIdNum}
        runHeat={runHeatNum}
        modes={heatModes(access)}
        heats={sortedHeats}
        roster={roster}
        leagueRoster={leagueRoster}
        athletes={organizationAthletes}
        checkIns={(checkIns ?? []).map((c) => ({
          athleteNo: c.athlete_no,
          runHeat: c.run_heat,
        }))}
        remotePositionCaptures={positionCaptures ?? []}
        remoteTimeCaptures={timeCaptures ?? []}
        remoteRunResults={runResults ?? []}
        remoteNotes={notes ?? []}
        remoteHeatClosed={
          leagueRaceError ? undefined : toHeatClosed(leagueRace)
        }
        duplicateRunResults={leagueRunResults ?? []}
        onTeam={team && admins ? onTeam : undefined}
      />
    </>
  );
}
