import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLeagueResults } from "@/lib/results/query";
import {
  filterGroups,
  shapeResults,
  type Gender,
  type ResultsGroup,
  type ShapedAthlete,
} from "@/lib/results/shape";
import { BreakdownToggle } from "@/components/results/breakdown-toggle";
import { cn } from "@/lib/utils";

// Anyone can open this page, signed in or not. A slug that matches no
// Public or Protected League, including a Private League's former address,
// is not-found, so a League's existence is never revealed.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const results = await getLeagueResults(slug);
  if (!results) return {};
  return {
    title: `${results.name} results`,
    // A Protected League's link is meant for the people who were given it.
    robots: results.visibility === "protected" ? { index: false } : undefined,
  };
}

type SearchParams = Promise<{ g?: string; age?: string }>;

export default function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading results…</p>}
    >
      <Results params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const points = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

const GENDERS: { value: Gender; label: string }[] = [
  { value: "F", label: "Girls/Ladies" },
  { value: "M", label: "Boys/Men" },
];

const chip = "shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap";
const chipActive = "border-primary bg-primary text-primary-foreground";

async function Results({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const results = await getLeagueResults(slug);
  if (!results) notFound();

  const gender: Gender = query.g === "M" ? "M" : "F";
  const all = shapeResults(results.athletes, results.points_table);
  const forGender = filterGroups(all, { gender });
  const ageGroups = forGender.filter((g) => g.age_group_code !== null);
  // An age group this gender has no results for falls back to All.
  const ageGroup = ageGroups.some((g) => g.age_group_code === query.age)
    ? query.age
    : undefined;
  const groups = filterGroups(all, { gender, ageGroup });

  const href = (g: Gender, age?: string) => {
    const search = new URLSearchParams({ g });
    if (age) search.set("age", age);
    return `?${search}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {results.organization_name}
        </p>
        <h1 className="text-2xl font-bold">{results.name}</h1>
        <p className="text-sm text-muted-foreground">
          {results.league_date} · Season {results.season}
        </p>
        <p className="text-sm text-muted-foreground">
          {results.heats_closed} of {results.heats_total} run heats closed
        </p>
      </div>

      <nav
        aria-label="Gender"
        className="grid grid-cols-2 rounded-md border border-input p-1"
      >
        {GENDERS.map((option) => (
          <Link
            key={option.value}
            href={href(option.value)}
            replace
            scroll={false}
            aria-current={option.value === gender ? "page" : undefined}
            className={cn(
              "rounded px-3 py-1.5 text-center text-sm font-medium",
              option.value === gender && chipActive,
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {ageGroups.length > 0 && (
        <nav
          aria-label="Age group"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          <Link
            href={href(gender)}
            replace
            scroll={false}
            aria-current={!ageGroup ? "page" : undefined}
            className={cn(chip, !ageGroup && chipActive)}
          >
            All
          </Link>
          {ageGroups.map((g) => (
            <Link
              key={g.age_group_code}
              href={href(gender, g.age_group_code ?? undefined)}
              replace
              scroll={false}
              aria-current={g.age_group_code === ageGroup ? "page" : undefined}
              className={cn(chip, g.age_group_code === ageGroup && chipActive)}
            >
              {g.age_group_label}
            </Link>
          ))}
        </nav>
      )}

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          No results yet. Times appear here as heats are closed.
        </p>
      ) : (
        <BreakdownToggle>
          {groups.map((group) => (
            <GroupSection
              key={group.title}
              group={group}
              showHeader={!ageGroup}
            />
          ))}
        </BreakdownToggle>
      )}

      <p className="text-xs text-muted-foreground">
        Points shown exclude age-related bonus points and are not official SA
        Biathlon points.
      </p>
    </main>
  );
}

function GroupSection({
  group,
  showHeader,
}: {
  group: ResultsGroup;
  showHeader: boolean;
}) {
  const athletes = [...group.ranked, ...group.unranked];
  return (
    <section>
      {showHeader && (
        <h2 className="sticky top-0 z-10 flex items-baseline justify-between bg-background px-1 py-1.5 text-sm font-semibold">
          <span>{group.age_group_label ?? "Unclassified"}</span>
          <span className="font-normal text-muted-foreground">
            {athletes.length}
          </span>
        </h2>
      )}
      <ul className="divide-y rounded-md border border-input">
        {athletes.map((athlete, i) => (
          <AthleteRow key={i} athlete={athlete} />
        ))}
      </ul>
    </section>
  );
}

function AthleteRow({ athlete }: { athlete: ShapedAthlete }) {
  return (
    <li className="px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
          {athlete.rank ?? ""}
        </span>
        <span className="min-w-0 flex-1 truncate">{athlete.full_name}</span>
        <span className="font-medium tabular-nums">
          {points(athlete.total_points)}
        </span>
      </div>
      <p className="mt-0.5 hidden flex-wrap gap-x-4 pl-9 text-xs text-muted-foreground tabular-nums group-data-[breakdown=true]/breakdown:flex">
        <span>
          Run {athlete.run_time ?? "—"} · {points(athlete.run_points)}
        </span>
        <span>
          Swim {athlete.swim_time ?? "—"} · {points(athlete.swim_points)}
        </span>
      </p>
    </li>
  );
}
