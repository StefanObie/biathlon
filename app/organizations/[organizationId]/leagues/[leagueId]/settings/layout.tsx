import { Suspense } from "react";

import { settingsGroups } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { SETTINGS_TITLE } from "@/lib/leagues/settings-screens";
import { SettingsNav } from "@/components/leagues/settings-nav";

export default function LeagueSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense>
        <SettingsPhases params={params} />
      </Suspense>
      {children}
    </div>
  );
}

// The screens themselves show "no access", and a bad address not-found.
async function SettingsPhases({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  const { organizationId, leagueId } = await params;
  const league = {
    organizationId: Number(organizationId),
    leagueId: Number(leagueId),
  };
  if (!Number.isInteger(league.organizationId)) return null;
  if (!Number.isInteger(league.leagueId)) return null;

  const access = await getLeagueAccess(league.organizationId, league.leagueId);
  if (!access) return null;

  return (
    <SettingsNav
      home={leagueAddress(league, "settings")}
      phases={settingsGroups(access).map((group) => ({
        title: group.title,
        links: group.screens.map((screen) => ({
          title: SETTINGS_TITLE[screen],
          href: leagueAddress(league, screen),
        })),
      }))}
    />
  );
}
