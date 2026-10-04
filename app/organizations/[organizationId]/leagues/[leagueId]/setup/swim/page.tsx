import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import {
  SwimImport,
  type ExistingSwimResult,
} from "@/components/capture/swim-import";
import type { RosterEntry } from "@/lib/swim/resolve";

export default function SwimImportPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading swim import…</p>}
    >
      <SwimImportSection params={params} />
    </Suspense>
  );
}

async function SwimImportSection({
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
  if (!access || !canUse(access, "swim")) return <NoAccess />;

  const supabase = await createClient();

  const [
    { data: entries, error: entriesError },
    { data: existing },
    { data: league },
  ] = await Promise.all([
    // The whole league roster: resolution keys off (swim_heat, swim_lane)
    // across every heat in the file, not one heat at a time (§4.6).
    supabase
      .from("entry")
      .select("athlete_no, swim_heat, swim_lane, athlete(full_name)")
      .eq("league_id", leagueIdNum)
      .order("swim_heat")
      .order("swim_lane"),
    // Already-saved results, so a re-import can show what it would change
    // and flag rows an operator has manually corrected.
    supabase
      .from("swim_result")
      .select("athlete_no, swim_time, status, source")
      .eq("league_id", leagueIdNum),
    supabase.from("league").select("name").eq("id", leagueIdNum).maybeSingle(),
  ]);

  if (entriesError) {
    return <p className="text-sm text-destructive">{entriesError.message}</p>;
  }

  const roster: RosterEntry[] = (entries ?? []).map((entry) => ({
    athleteNo: entry.athlete_no,
    fullName: entry.athlete?.full_name ?? `Athlete ${entry.athlete_no}`,
    swimHeat: entry.swim_heat,
    swimLane: entry.swim_lane,
  }));

  if (roster.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No athletes in this league yet — import a start list first.
      </p>
    );
  }

  return (
    <SwimImport
      organizationId={organizationIdNum}
      leagueId={leagueIdNum}
      leagueName={league?.name ?? `League ${leagueIdNum}`}
      roster={roster}
      existing={(existing ?? []) as ExistingSwimResult[]}
    />
  );
}
