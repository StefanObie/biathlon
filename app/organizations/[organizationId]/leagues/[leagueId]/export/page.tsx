import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { getExportData } from "@/lib/export/query";
import { ExportPreview } from "@/components/leagues/export-preview";

export default function ExportPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
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
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  const { organizationId, leagueId } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(organizationIdNum) || !Number.isInteger(leagueIdNum)) {
    notFound();
  }

  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);
  if (!access || !canUse(access, "export")) return <NoAccess />;

  const supabase = await createClient();
  const { rows, excludedCount, openHeatAthleteCount, openHeats, leagueName } =
    await getExportData(supabase, leagueIdNum);

  return (
    <ExportPreview
      organizationId={organizationIdNum}
      leagueId={leagueIdNum}
      leagueName={leagueName}
      rows={rows}
      excludedCount={excludedCount}
      openHeatAthleteCount={openHeatAthleteCount}
      openHeats={openHeats}
    />
  );
}
