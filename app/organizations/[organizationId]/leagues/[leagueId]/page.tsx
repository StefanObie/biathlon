import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canUse, type LeagueScreen } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { leagueAddress } from "@/lib/leagues/address";
import { NoAccess } from "@/components/leagues/no-access";

interface NavSection {
  screen: LeagueScreen;
  title: string;
  description: string;
  available: boolean;
}

const SECTIONS: NavSection[] = [
  {
    screen: "start-list",
    title: "Start list",
    description: "Import entries, view the roster, download bib QR codes.",
    available: true,
  },
  {
    screen: "position",
    title: "Position",
    description: "Table capture — track finish order by athlete number.",
    available: true,
  },
  {
    screen: "call-room",
    title: "Call room",
    description: "Check in the athletes of each heat before it runs.",
    available: true,
  },
  {
    screen: "timer",
    title: "Timer",
    description: "Finish-line timer — one button per finisher.",
    available: true,
  },
  {
    screen: "reconcile",
    title: "Reconcile",
    description: "Match positions to times, fix gaps, save results.",
    available: true,
  },
  {
    screen: "swim",
    title: "Swim import",
    description: "Upload the swim results file, review, and save times.",
    available: true,
  },
  {
    screen: "export",
    title: "Export",
    description: "Review combined swim and run times, download the XML.",
    available: true,
  },
  {
    screen: "team",
    title: "Team",
    description: "Choose who works on this league, and in which Roles.",
    available: true,
  },
  {
    screen: "settings",
    title: "Results",
    description: "Choose who can see this league's published results.",
    available: true,
  },
];

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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SECTIONS.filter((section) => canUse(access, section.screen)).map(
        (section) =>
          section.available ? (
            <Link
              key={section.title}
              href={leagueAddress(
                { organizationId: organizationIdNum, leagueId: leagueIdNum },
                section.screen,
              )}
              className="flex flex-col gap-1 rounded-md border border-input p-4 hover:bg-accent"
            >
              <span className="font-semibold">{section.title}</span>
              <span className="text-sm text-muted-foreground">
                {section.description}
              </span>
            </Link>
          ) : (
            <div
              key={section.title}
              className="flex flex-col gap-1 rounded-md border border-dashed border-input p-4 opacity-50"
            >
              <span className="font-semibold">
                {section.title} <span className="text-xs">(coming soon)</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {section.description}
              </span>
            </div>
          ),
      )}
    </div>
  );
}
