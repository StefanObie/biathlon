import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canSetUp, raceDayScreens, type HeatMode } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { NoAccess } from "@/components/leagues/no-access";

const RACE_DAY: Record<HeatMode, { title: string; description: string }> = {
  position: {
    title: "Position",
    description: "Table capture — track finish order by athlete number.",
  },
  "call-room": {
    title: "Call room",
    description: "Check in the athletes of each heat before it runs.",
  },
  timer: {
    title: "Timer",
    description: "Finish-line timer — one button per finisher.",
  },
  reconcile: {
    title: "Reconcile",
    description: "Match positions to times, fix gaps, save results.",
  },
};

export default function LeagueIndexPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <LeagueNav params={params} />
    </Suspense>
  );
}

async function LeagueNav({
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
  if (!access) return <NoAccess />;

  const league = { organizationId: organizationIdNum, leagueId: leagueIdNum };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {raceDayScreens(access).map((screen) => (
          <Link
            key={screen}
            href={leagueAddress(league, screen)}
            className="flex min-h-24 flex-col justify-center gap-1 rounded-md border border-input p-5 hover:bg-accent"
          >
            <span className="text-lg font-semibold">
              {RACE_DAY[screen].title}
            </span>
            <span className="text-sm text-muted-foreground">
              {RACE_DAY[screen].description}
            </span>
          </Link>
        ))}
        {canSetUp(access) && (
          <Link
            href={leagueAddress(league, "setup")}
            className="flex min-h-24 flex-col justify-center gap-1 rounded-md border border-input p-5 hover:bg-accent"
          >
            <span className="text-lg font-semibold">Setup</span>
            <span className="text-sm text-muted-foreground">
              Athletes, heats, and league settings.
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
