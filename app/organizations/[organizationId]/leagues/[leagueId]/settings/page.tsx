import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";

import { settingsGroups } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { SETTINGS_TITLE } from "@/lib/leagues/settings-screens";
import { NoAccess } from "@/components/leagues/no-access";

export default function LeagueSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <SettingsHub params={params} />
    </Suspense>
  );
}

async function SettingsHub({
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
  const groups = access ? settingsGroups(access) : [];
  if (groups.length === 0) return <NoAccess />;

  const league = { organizationId: organizationIdNum, leagueId: leagueIdNum };

  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <h2 className="text-lg font-medium">League settings</h2>
      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {group.title}
          </h3>
          <div className="divide-y rounded-lg border">
            {group.screens.map((screen) => (
              <Link
                key={screen}
                href={leagueAddress(league, screen)}
                className="flex min-h-14 items-center justify-between gap-3 px-4 font-medium first:rounded-t-lg last:rounded-b-lg hover:bg-accent active:bg-accent"
              >
                {SETTINGS_TITLE[screen]}
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
