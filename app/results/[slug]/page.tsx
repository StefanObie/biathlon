import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getLeagueResults } from "@/lib/results/query";

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

async function Results({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const results = await getLeagueResults(slug);
  if (!results) notFound();

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
      </div>

      {results.heats.length === 0 ? (
        <p className="text-muted-foreground">
          No results yet. Each heat appears here once it has been closed.
        </p>
      ) : (
        results.heats.map((heat) => (
          <section key={heat.run_heat} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Heat {heat.run_heat}</h2>
            <ul className="divide-y rounded-md border border-input">
              {heat.athletes.map((athlete) => (
                <li
                  key={athlete.athlete_no}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span>{athlete.full_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {athlete.age_group_code}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
