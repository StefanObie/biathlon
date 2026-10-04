import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setupGroups, type SetupScreen } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { NoAccess } from "@/components/leagues/no-access";

const SETUP: Record<SetupScreen, { title: string; description: string }> = {
  "start-list": {
    title: "Start list",
    description: "Import entries, view the roster, download bib QR codes.",
  },
  team: {
    title: "League team",
    description: "Choose who works on this league, and in which Roles.",
  },
  results: {
    title: "Visibility",
    description: "Choose who can see this league's published results.",
  },
  swim: {
    title: "Swim import",
    description: "Upload the swim results file, review, and save times.",
  },
  export: {
    title: "Export",
    description: "Review combined swim and run times, download the XML.",
  },
};

export default function LeagueSetupPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-24" />}>
      <SetupHub params={params} />
    </Suspense>
  );
}

async function SetupHub({
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
  const groups = access ? setupGroups(access) : [];
  if (groups.length === 0) return <NoAccess />;

  const league = { organizationId: organizationIdNum, leagueId: leagueIdNum };

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.screens.map((screen) => (
              <Link
                key={screen}
                href={leagueAddress(league, screen)}
                className="flex flex-col gap-1 rounded-md border border-input p-4 hover:bg-accent"
              >
                <span className="font-semibold">{SETUP[screen].title}</span>
                <span className="text-sm text-muted-foreground">
                  {SETUP[screen].description}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
