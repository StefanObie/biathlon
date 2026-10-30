import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { HeatGrid } from "@/components/call-room/heat-grid";
import { NoAccess } from "@/components/leagues/no-access";

export default function SwimCallRoomHeatPickerPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading heats…</p>}
    >
      <SwimHeatList params={params} />
    </Suspense>
  );
}

async function SwimHeatList({
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
    .select("swim_heat")
    .eq("league_id", leagueIdNum)
    .not("swim_heat", "is", null)
    .order("swim_heat");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const league = { organizationId: organizationIdNum, leagueId: leagueIdNum };
  const heats = [
    ...new Set(
      (entries ?? []).flatMap((e) =>
        e.swim_heat === null ? [] : [e.swim_heat],
      ),
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Swim call room</h2>
      {heats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No swim heats found — import a start list with swim heats first.
        </p>
      ) : (
        <HeatGrid
          heats={heats}
          href={(heat) => leagueAddress(league, "call-room-swim", heat)}
        />
      )}
    </div>
  );
}
