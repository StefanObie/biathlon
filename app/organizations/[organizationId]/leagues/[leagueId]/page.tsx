import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { homeTiles } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { SCREEN_LABEL } from "@/lib/navigation/navigation";
import { NoAccess } from "@/components/leagues/no-access";
import { SCREEN_ICON } from "@/components/leagues/screen-icons";

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
    <div className="grid max-w-[720px] grid-cols-2 gap-3">
      {homeTiles(access).map((screen) => {
        const Icon = SCREEN_ICON[screen];
        return (
          <Link
            key={screen}
            href={leagueAddress(league, screen)}
            className="flex min-h-[88px] min-w-0 flex-col justify-center gap-2 rounded-md border border-input p-4 hover:bg-accent active:bg-accent lg:min-h-20"
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="font-medium leading-tight">
              {SCREEN_LABEL[screen]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
