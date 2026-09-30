import { Suspense } from "react";
import { notFound } from "next/navigation";

import { toHeatClosed } from "@/lib/capture/heat-closed";
import { createClient } from "@/lib/supabase/server";
import { canUse, heatModes } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { Reconcile } from "@/components/capture/reconcile";

export default function ReconcileHeatPage({
  params,
}: {
  params: Promise<{ leagueId: string; runHeat: string }>;
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
  params: Promise<{ leagueId: string; runHeat: string }>;
}) {
  const { leagueId, runHeat } = await params;
  const leagueIdNum = Number(leagueId);
  const runHeatNum = Number(runHeat);
  if (!Number.isInteger(leagueIdNum) || !Number.isInteger(runHeatNum)) {
    notFound();
  }

  const access = await getLeagueAccess(leagueIdNum);
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
    <Reconcile
      leagueId={leagueIdNum}
      leagueName={league?.name ?? `League ${leagueIdNum}`}
      runHeat={runHeatNum}
      modes={heatModes(access)}
      heats={sortedHeats}
      roster={roster}
      leagueRoster={leagueRoster}
      checkIns={(checkIns ?? []).map((c) => ({
        athleteNo: c.athlete_no,
        runHeat: c.run_heat,
      }))}
      remotePositionCaptures={positionCaptures ?? []}
      remoteTimeCaptures={timeCaptures ?? []}
      remoteRunResults={runResults ?? []}
      remoteNotes={notes ?? []}
      remoteHeatClosed={leagueRaceError ? undefined : toHeatClosed(leagueRace)}
      duplicateRunResults={leagueRunResults ?? []}
      onTeam={team && admins ? onTeam : undefined}
    />
  );
}
