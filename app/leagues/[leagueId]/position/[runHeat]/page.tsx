import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PositionCapture } from "@/components/capture/position-capture";

export default function PositionHeatPage({
  params,
}: {
  params: Promise<{ leagueId: string; runHeat: string }>;
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
  params: Promise<{ leagueId: string; runHeat: string }>;
}) {
  const { leagueId, runHeat } = await params;
  const leagueIdNum = Number(leagueId);
  const runHeatNum = Number(runHeat);
  if (!Number.isInteger(leagueIdNum) || !Number.isInteger(runHeatNum)) {
    notFound();
  }

  const supabase = await createClient();

  const [{ data: leagueEntries, error: entriesError }, { data: captures }] =
    await Promise.all([
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
    ]);

  if (entriesError) {
    return <p className="text-sm text-destructive">{entriesError.message}</p>;
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
  const nextHeat = heats.find((h) => h > runHeatNum) ?? null;

  return (
    <PositionCapture
      leagueId={leagueIdNum}
      runHeat={runHeatNum}
      nextHeat={nextHeat}
      leagueRoster={leagueRoster}
      remoteCaptures={captures ?? []}
    />
  );
}
