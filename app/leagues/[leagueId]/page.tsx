import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface NavSection {
  href: (leagueId: string) => string;
  title: string;
  description: string;
  available: boolean;
}

const SECTIONS: NavSection[] = [
  {
    href: (id) => `/leagues/${id}/start-list`,
    title: "Start list",
    description: "Import entries, view the roster, download bib QR codes.",
    available: true,
  },
  {
    href: (id) => `/leagues/${id}/position`,
    title: "Position",
    description: "Table capture — track finish order by athlete number.",
    available: true,
  },
  {
    href: (id) => `/leagues/${id}/timer`,
    title: "Timer",
    description: "Finish-line timer — one button per finisher.",
    available: true,
  },
  {
    href: (id) => `/leagues/${id}/reconcile`,
    title: "Reconcile",
    description: "Match positions to times, fix gaps, save results.",
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SECTIONS.map((section) =>
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
