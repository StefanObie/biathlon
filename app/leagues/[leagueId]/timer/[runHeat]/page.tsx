import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TimeCapture } from "@/components/capture/time-capture";

export default function TimerHeatPage({
  params,
}: {
  params: Promise<{ leagueId: string; runHeat: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading heat…</p>}>
      <TimerHeatSection params={params} />
    </Suspense>
  );
}

async function TimerHeatSection({
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
    { data: entries, error: entriesError },
    { data: captures },
    { data: leagueRace },
    { data: league },
  ] = await Promise.all([
    supabase.from("entry").select("run_heat").eq("league_id", leagueIdNum),
    supabase
      .from("time_capture")
      .select(
        "id, seq, elapsed_time, is_placeholder, voided, void_reason, captured_at, device_id",
      )
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .order("seq"),
    supabase
      .from("league_race")
      .select("started_at, device_id")
      .eq("league_id", leagueIdNum)
      .eq("run_heat", runHeatNum)
      .maybeSingle(),
    supabase.from("league").select("name").eq("id", leagueIdNum).maybeSingle(),
  ]);

  if (entriesError) {
    return <p className="text-sm text-destructive">{entriesError.message}</p>;
  }

  const heats = [...new Set((entries ?? []).map((e) => e.run_heat))];

  if (!heats.includes(runHeatNum)) {
    return (
      <p className="text-sm text-muted-foreground">
        No athletes assigned to run heat {runHeatNum}.
      </p>
    );
  }

  return (
    <TimeCapture
      leagueId={leagueIdNum}
      leagueName={league?.name ?? `League ${leagueIdNum}`}
      runHeat={runHeatNum}
      heats={heats}
      remoteCaptures={captures ?? []}
      remoteLeagueRace={leagueRace ?? null}
    />
  );
}
