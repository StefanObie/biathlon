import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLeagueResults } from "@/lib/results/query";
import { shapeResults, type ShapedAthlete } from "@/lib/results/shape";

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

export default function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading results…</p>}
    >
      <Results params={params} />
    </Suspense>
  );
}

const points = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

async function Results({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const results = await getLeagueResults(slug);
  if (!results) notFound();

  const groups = shapeResults(results.athletes, results.points_table);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
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

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          No results yet. Times appear here as heats are closed.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <div className="overflow-x-auto rounded-md border border-input">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Athlete</th>
                    <th className="px-3 py-2 text-right font-medium">Run</th>
                    <th className="px-3 py-2 text-right font-medium">Swim</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...group.ranked, ...group.unranked].map((athlete, i) => (
                    <AthleteRow key={i} athlete={athlete} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Points shown exclude age-related bonus points and are not official SA
        Biathlon points.
      </p>
    </main>
  );
}

function AthleteRow({ athlete }: { athlete: ShapedAthlete }) {
  return (
    <tr className="align-top">
      <td className="px-3 py-2 text-muted-foreground">{athlete.rank ?? ""}</td>
      <td className="px-3 py-2">{athlete.full_name}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <div>{athlete.run_time ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {points(athlete.run_points)}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <div>{athlete.swim_time ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {points(athlete.swim_points)}
        </div>
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">
        {points(athlete.total_points)}
      </td>
    </tr>
  );
}
