import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  StartList,
  type StartListEntry,
} from "@/components/leagues/start-list";

export default function StartListPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading start list…</p>}
    >
      <StartListSection params={params} />
    </Suspense>
  );
}

async function StartListSection({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(leagueIdNum)) notFound();

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entry")
    .select(
      "athlete_no, run_heat, swim_heat, swim_lane, age_group_code, athlete(full_name, gender)",
    )
    .eq("league_id", leagueIdNum)
    .order("run_heat")
    .order("athlete_no");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const committed: StartListEntry[] = (entries ?? []).map((entry) => ({
    athleteNo: entry.athlete_no,
    fullName: entry.athlete?.full_name ?? "",
    gender: entry.athlete?.gender ?? "",
    ageGroupCode: entry.age_group_code,
    runHeat: entry.run_heat,
    swimHeat: entry.swim_heat,
    swimLane: entry.swim_lane,
  }));

  return <StartList leagueId={leagueIdNum} committed={committed} />;
}
