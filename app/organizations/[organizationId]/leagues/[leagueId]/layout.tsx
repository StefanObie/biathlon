import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasSettings } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
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

  const ref = { organizationId: organizationIdNum, leagueId: leagueIdNum };
  const access = await getLeagueAccess(organizationIdNum, leagueIdNum);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-medium leading-tight">
          <Link href={leagueAddress(ref)} className="hover:underline">
            {league.name}
          </Link>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {league.league_date} · Season {league.season}
        </p>
      </div>
      {access && hasSettings(access) && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-11 shrink-0 [&_svg]:size-5"
        >
          <Link
            href={leagueAddress(ref, "settings")}
            aria-label="League settings"
          >
            <SettingsIcon aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}
