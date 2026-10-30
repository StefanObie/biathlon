import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { HeatGrid } from "@/components/call-room/heat-grid";
import { NoAccess } from "@/components/leagues/no-access";

export default function CallRoomHeatPickerPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading heats…</p>}
    >
      <HeatList params={params} />
    </Suspense>
  );
}

async function HeatList({
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
  if (!access || !canUse(access, "call-room")) return <NoAccess />;

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entry")
    .select("run_heat")
    .eq("league_id", leagueIdNum)
    .order("run_heat");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const league = { organizationId: organizationIdNum, leagueId: leagueIdNum };
  const heats = [...new Set((entries ?? []).map((e) => e.run_heat))];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Run call room</h2>
      {heats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No run heats found — import a start list first.
        </p>
      ) : (
        <HeatGrid
          heats={heats}
          href={(heat) => leagueAddress(league, "call-room", heat)}
        />
      )}
    </div>
  );
}
