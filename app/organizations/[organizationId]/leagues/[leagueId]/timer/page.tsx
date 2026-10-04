import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { NoAccess } from "@/components/leagues/no-access";

export default function TimerHeatPickerPage({
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
  if (!access || !canUse(access, "timer")) return <NoAccess />;

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entry")
    .select("run_heat")
    .eq("league_id", leagueIdNum)
    .order("run_heat");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const heats = [...new Set((entries ?? []).map((e) => e.run_heat))];

  if (heats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No run heats found — import a start list first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Finish-Line Timer</h1>
      <h2 className="text-lg font-semibold">Select a Heat</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {heats.map((heat) => (
          <Link
            key={heat}
            href={leagueAddress(
              { organizationId: organizationIdNum, leagueId: leagueIdNum },
              "timer",
              heat,
            )}
            className="flex h-20 items-center justify-center rounded-md border border-input text-2xl font-bold tabular-nums hover:bg-accent"
          >
            {heat}
          </Link>
        ))}
      </div>
    </div>
  );
}
