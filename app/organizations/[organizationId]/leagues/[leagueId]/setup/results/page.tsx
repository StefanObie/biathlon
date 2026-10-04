import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/access/roles";
import { getLeagueAccess } from "@/lib/access/league-access";
import { NoAccess } from "@/components/leagues/no-access";
import { ResultsSettings } from "@/components/leagues/results-settings";

export default function LeagueSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string; leagueId: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading settings…</p>}
    >
      <LeagueSettingsSection params={params} />
    </Suspense>
  );
}

async function LeagueSettingsSection({
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
  if (!access || !canUse(access, "results")) return <NoAccess />;

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("league")
    .select("visibility, results_slug")
    .eq("id", leagueIdNum)
    .maybeSingle();
  if (!league) return <NoAccess />;

  return (
    <ResultsSettings
      organizationId={organizationIdNum}
      leagueId={leagueIdNum}
      visibility={league.visibility}
      slug={league.results_slug}
    />
  );
}
