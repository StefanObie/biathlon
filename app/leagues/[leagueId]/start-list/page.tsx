import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { StartList, type StartListEntry } from "@/components/meets/start-list";

export default function StartListPage({
  params,
}: {
  params: Promise<{ meetId: string }>;
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
  params: Promise<{ meetId: string }>;
}) {
  const { meetId } = await params;
  const meetIdNum = Number(meetId);
  if (!Number.isInteger(meetIdNum)) notFound();

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entry")
    .select(
      "athlete_no, run_heat, swim_heat, swim_lane, age_group_code, athlete(full_name, gender)",
    )
    .eq("meet_id", meetIdNum)
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

  return <StartList meetId={meetIdNum} committed={committed} />;
}
