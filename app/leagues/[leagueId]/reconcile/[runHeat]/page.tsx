import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  const [
    { data: leagueEntries, error: entriesError },
    { data: positionCaptures },
    { data: timeCaptures },
    { data: runResults },
    { data: leagueRunResults },
    { data: league },
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
        "id, position, athlete_no, voided, void_reason, scanned_at, device_id",
      )
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .order("position"),
    supabase
      .from("time_capture")
      .select(
        "id, seq, elapsed_time, is_placeholder, voided, void_reason, captured_at, device_id",
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
    supabase.from("league").select("name").eq("id", leagueIdNum).maybeSingle(),
  ]);

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
      heats={sortedHeats}
      roster={roster}
      leagueRoster={leagueRoster}
      remotePositionCaptures={positionCaptures ?? []}
      remoteTimeCaptures={timeCaptures ?? []}
      remoteRunResults={runResults ?? []}
      duplicateRunResults={leagueRunResults ?? []}
    />
  );
}
