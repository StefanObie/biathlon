import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canUse, type LeagueScreen } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";

interface NavSection {
  screen: LeagueScreen;
  href: (leagueId: string) => string;
  title: string;
  description: string;
  available: boolean;
}

const SECTIONS: NavSection[] = [
  {
    screen: "start-list",
    href: (id) => `/leagues/${id}/start-list`,
    title: "Start list",
    description: "Import entries, view the roster, download bib QR codes.",
    available: true,
  },
  {
    screen: "position",
    href: (id) => `/leagues/${id}/position`,
    title: "Position",
    description: "Table capture — track finish order by athlete number.",
    available: true,
  },
  {
    screen: "call-room",
    href: (id) => `/leagues/${id}/call-room`,
    title: "Call room",
    description: "Check in the athletes of each heat before it runs.",
    available: true,
  },
  {
    screen: "timer",
    href: (id) => `/leagues/${id}/timer`,
    title: "Timer",
    description: "Finish-line timer — one button per finisher.",
    available: true,
  },
  {
    screen: "reconcile",
    href: (id) => `/leagues/${id}/reconcile`,
    title: "Reconcile",
    description: "Match positions to times, fix gaps, save results.",
    available: true,
  },
  {
    screen: "swim",
    href: (id) => `/leagues/${id}/swim`,
    title: "Swim import",
    description: "Upload the swim results file, review, and save times.",
    available: true,
  },
  {
    screen: "export",
    href: (id) => `/leagues/${id}/export`,
    title: "Export",
    description: "Review combined swim and run times, download the XML.",
    available: true,
  },
  {
    screen: "team",
    href: (id) => `/leagues/${id}/team`,
    title: "Team",
    description: "Choose who works on this league, and in which Roles.",
    available: true,
  },
  {
    screen: "settings",
    href: (id) => `/leagues/${id}/settings`,
    title: "Results",
    description: "Choose who can see this league's published results.",
    available: true,
  },
];

export default function LeagueIndexPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
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
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(leagueIdNum)) notFound();

  const access = await getLeagueAccess(leagueIdNum);
  if (!access) return <NoAccess />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SECTIONS.filter((section) => canUse(access, section.screen)).map(
        (section) =>
          section.available ? (
            <Link
              key={section.title}
              href={section.href(leagueId)}
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
