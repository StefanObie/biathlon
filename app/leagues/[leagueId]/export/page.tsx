import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getExportData } from "@/lib/export/query";
import { ExportPreview } from "@/components/leagues/export-preview";

export default function ExportPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading export…</p>}
    >
      <ExportSection params={params} />
    </Suspense>
  );
}

async function ExportSection({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(leagueIdNum)) notFound();

  const supabase = await createClient();
  const { rows, excludedCount, openHeatAthleteCount, openHeats, leagueName } =
    await getExportData(supabase, leagueIdNum);

  return (
    <ExportPreview
      leagueId={leagueIdNum}
      leagueName={leagueName}
      rows={rows}
      excludedCount={excludedCount}
      openHeatAthleteCount={openHeatAthleteCount}
      openHeats={openHeats}
    />
  );
}
