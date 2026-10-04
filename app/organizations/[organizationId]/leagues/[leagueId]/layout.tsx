import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { leagueAddress } from "@/lib/leagues/address";

export default function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; leagueId: string }>;
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
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  const { organizationId, leagueId } = await params;
  const organizationIdNum = Number(organizationId);
  const leagueIdNum = Number(leagueId);
  if (!Number.isInteger(organizationIdNum) || !Number.isInteger(leagueIdNum)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("league")
    .select("id, name, league_date, season, organization_id")
    .eq("id", leagueIdNum)
    .maybeSingle();

  // Hidden by RLS from anyone not on the League's team; the page below
  // shows them "no access".
  if (!league) return null;
  if (league.organization_id !== organizationIdNum) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">
        <Link
          href={leagueAddress({
            organizationId: organizationIdNum,
            leagueId: leagueIdNum,
          })}
          className="hover:underline"
        >
          {league.name}
        </Link>
      </h1>
      <p className="text-sm text-muted-foreground">
        {league.league_date} · Season {league.season}
      </p>
    </div>
  );
}
