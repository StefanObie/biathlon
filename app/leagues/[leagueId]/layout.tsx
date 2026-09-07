import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-14" />}>
        <LeagueHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function LeagueHeader({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(leagueIdNum)) notFound();

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("league")
    .select("id, name, league_date, season")
    .eq("id", leagueIdNum)
    .maybeSingle();

  if (!league) notFound();

  return (
    <div>
      <Link
        href="/leagues"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All leagues
      </Link>
      <h1 className="text-2xl font-bold">{league.name}</h1>
      <p className="text-sm text-muted-foreground">
        {league.league_date} · Season {league.season}
      </p>
    </div>
  );
}
